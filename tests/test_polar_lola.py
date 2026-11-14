import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.features.visibility.polar_lola import (
    decode_sample_radius_m, label_projection_to_pixel, horizon_document,
    validate_label, compute_horizon, MAX_RAY_SAMPLES,
)

try:
    import rasterio
    from rasterio.transform import from_origin
except ImportError:
    rasterio = None
    from_origin = None


class PolarLolaTests(unittest.TestCase):
    def test_decodes_signed_dn_as_half_meter_radius_values(self):
        self.assertEqual(decode_sample_radius_m(-2), 1737399.0)
        self.assertEqual(decode_sample_radius_m(4), 1737402.0)

    def test_validates_pds_product_geometry_and_rejects_wrong_scale(self):
        label = {"PRODUCT_ID":"LDEM_80S_80M","PRODUCT_VERSION_ID":"V2.1","DATA_SET_ID":"LRO-L-LOLA-4-GDR-V1.0",
            "LINES":7600,"LINE_SAMPLES":7600,"SAMPLE_BITS":16,"SAMPLE_TYPE":"LSB_INTEGER","UNIT":"METER",
            "SCALING_FACTOR":0.5,"OFFSET":1737400,"MAP_PROJECTION_TYPE":"POLAR STEREOGRAPHIC",
            "KEYWORD_LATITUDE_TYPE":"PLANETOCENTRIC","CENTER_LATITUDE":-90,"CENTER_LONGITUDE":0,
            "MINIMUM_LATITUDE":-90,"MAXIMUM_LATITUDE":-80,"MAP_SCALE":80,
            "POSITIVE_LONGITUDE_DIRECTION":"EAST","COORDINATE_SYSTEM_NAME":"MEAN EARTH/POLAR AXIS OF DE421",
            "COORDINATE_SYSTEM_TYPE":"BODY-FIXED ROTATING"}
        self.assertEqual(validate_label(label)["product"], "LDEM_80S_80M")
        label["MAP_SCALE"] = 800
        with self.assertRaises(ValueError): validate_label(label)

    def test_south_pole_projection_orientation_and_center_indices(self):
        pole = label_projection_to_pixel(0,-90,7600,80,3799.5,3799.5)
        east = label_projection_to_pixel(90,-89,7600,80,3799.5,3799.5)
        prime = label_projection_to_pixel(0,-89,7600,80,3799.5,3799.5)
        self.assertEqual(pole,(3799.5,3799.5))
        self.assertGreater(east[0],pole[0])
        self.assertAlmostEqual(east[1],pole[1],delta=1e-6)
        self.assertAlmostEqual(prime[0],pole[0],delta=1e-6)
        self.assertLess(prime[1],pole[1])
        self.assertAlmostEqual(prime[1],3420.45,delta=0.1)

    def test_horizon_document_matches_contract_with_surface_height_and_provenance(self):
        doc=horizon_document(site_id="south-pole-test",latitude_deg=-89.9,longitude_deg=0,observer_height_m=1.5,
            azimuth_step_deg=10,distance_step_m=1000,max_distance_m=200000,azimuth_deg=list(range(0,360,10)),
            elevation_deg=[0.0]*36,sha256="a"*64,source_url="https://example.test/dem.jp2",downloaded_bytes=100)
        self.assertEqual(doc["profile"]["model"],"terrain")
        self.assertEqual(doc["profile"]["dataKind"],"real")
        self.assertEqual(doc["coverage"]["maximumDistanceM"],200000)
        self.assertEqual(doc["provenance"]["product"],"LDEM_80S_80M")
        self.assertIsNone(doc["surfaceHeightM"])

    def test_workload_limit_rejects_before_raster_open_or_large_allocation(self):
        with self.assertRaisesRegex(ValueError,"workload"):
            compute_horizon("not-opened.jp2",site_id="x",latitude_deg=-89.9,longitude_deg=0,
                observer_height_m=0,azimuth_step_deg=1,distance_step_m=1,max_distance_m=200000)

    def test_rejects_modified_label_content_without_changing_trusted_hash(self):
        root=Path(__file__).resolve().parents[1]
        valid=(root/"data/raw/polar/ldem_80s_80m_jp2.lbl").read_bytes().decode("ascii")
        with self.assertRaisesRegex(ValueError,"label canonical SHA-256"):
            compute_horizon("missing.jp2",site_id="x",latitude_deg=-89.9,longitude_deg=0,
                observer_height_m=0,distance_step_m=240,max_distance_m=200000,
                label_text=valid+"\n/* modified test label */\n")

    def test_rejects_single_azimuth_and_tiny_step_with_controlled_error(self):
        for step in (360, 1e-320):
            with self.subTest(step=step), self.assertRaisesRegex(ValueError,"[Aa]zimuth|workload"):
                compute_horizon("not-opened.jp2",site_id="x",latitude_deg=-89.9,longitude_deg=0,
                    observer_height_m=0,azimuth_step_deg=step,distance_step_m=240,max_distance_m=200000)

    def test_exact_pole_rejected_as_azimuth_singularity(self):
        with self.assertRaisesRegex(ValueError,"Azimuth is undefined"):
            compute_horizon("not-opened.jp2",site_id="x",latitude_deg=-90,longitude_deg=0,
                observer_height_m=0,distance_step_m=240,max_distance_m=200000)

    @unittest.skipIf(rasterio is None, "polar dependencies not installed")
    def test_real_download_decodes_with_authoritative_sha_and_expected_polar_crs(self):
        root=Path(__file__).resolve().parents[1]
        image=root/"data/raw/polar/ldem_80s_80m.jp2"
        if not image.exists(): self.skipTest("official PDS raster not fetched")
        label=(root/"data/raw/polar/ldem_80s_80m_jp2.lbl").read_bytes().decode("ascii")
        doc=compute_horizon(image,site_id="polar-validation",latitude_deg=-89.9,longitude_deg=0,
            observer_height_m=1.5,azimuth_step_deg=30,distance_step_m=5000,max_distance_m=200000,label_text=label)
        self.assertEqual(doc["provenance"]["sha256"],"c088dd4f510e879375ee7e6f0d320ba84115f535f45fb592dd7f83a7d2e83ae3")
        self.assertAlmostEqual(doc["surfaceHeightM"],625.953454,places=3)
        self.assertEqual(len(doc["profile"]["azimuthDeg"]),12)

    @unittest.skipIf(rasterio is None, "polar dependencies not installed")
    def test_ray_rejects_north_boundary_crossing_before_raster_sampling(self):
        from src.features.visibility.polar_lola import _validate_ray_latitude
        with self.assertRaisesRegex(ValueError,"latitude coverage"):
            _validate_ray_latitude(-79.99)
        self.assertIsNone(_validate_ray_latitude(-80.0))

    def test_bilinear_sampler_rejects_nodata_and_raster_edge(self):
        from src.features.visibility.polar_lola import _sample_four
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"nodata.tif"
            with rasterio.open(p,"w",driver="GTiff",width=2,height=2,count=1,dtype="int16",nodata=-32768,
                               transform=from_origin(0,2,1,1)) as ds: ds.write(__import__("numpy").array([[1,-32768],[3,4]],dtype="int16"),1)
            with rasterio.open(p) as ds:
                with self.assertRaisesRegex(ValueError,"NoData"): _sample_four(ds,0.5,0.5)
                with self.assertRaisesRegex(ValueError,"four in-bounds"): _sample_four(ds,1,0.5)

    def test_rejects_mutated_raster_hash_before_decode(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"bad.jp2"; p.write_bytes(b"not the authoritative JP2")
            valid={"PRODUCT_ID":"LDEM_80S_80M","PRODUCT_VERSION_ID":"V2.1","DATA_SET_ID":"LRO-L-LOLA-4-GDR-V1.0",
                "LINES":7600,"LINE_SAMPLES":7600,"SAMPLE_BITS":16,"SAMPLE_TYPE":"LSB_INTEGER","UNIT":"METER",
                "SCALING_FACTOR":0.5,"OFFSET":1737400,"MAP_PROJECTION_TYPE":"POLAR STEREOGRAPHIC",
                "KEYWORD_LATITUDE_TYPE":"PLANETOCENTRIC","CENTER_LATITUDE":-90,"CENTER_LONGITUDE":0,
                "MINIMUM_LATITUDE":-90,"MAXIMUM_LATITUDE":-80,"MAP_SCALE":80,
                "POSITIVE_LONGITUDE_DIRECTION":"EAST","COORDINATE_SYSTEM_NAME":"MEAN EARTH/POLAR AXIS OF DE421",
                "COORDINATE_SYSTEM_TYPE":"BODY-FIXED ROTATING"}
            root=Path(__file__).resolve().parents[1]
            raw_label=(root/"data/raw/polar/ldem_80s_80m_jp2.lbl").read_bytes().decode("ascii")
            with self.assertRaisesRegex(ValueError,"Unexpected JP2 size"):
                compute_horizon(p,site_id="x",latitude_deg=-89.9,longitude_deg=0,
                    observer_height_m=0,distance_step_m=240,max_distance_m=200000,label_text=raw_label)


if __name__ == "__main__": unittest.main()
