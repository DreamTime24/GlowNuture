"""Safe static collection tests, no Firebase or external network needed."""
import base64
import csv
import json
import tempfile
import unittest
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = spec_from_file_location("client_collection", ROOT / "scripts/build_client_collection.py")
module = module_from_spec(SPEC)
SPEC.loader.exec_module(module)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==")

class CollectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.feed = self.root / "approved_products.csv"
        self.images = self.root / "images"
        self.images.mkdir()
        self.original_images = module.IMAGES
        module.IMAGES = self.images
        self.addCleanup(lambda: setattr(module, "IMAGES", self.original_images))
        self.rows = [{
            "product_id": "sku123",
            "name": "A genuine verified test item",
            "brand": "Fixture Brand",
            "category": "Cleanser",
            "size": "30ml",
            "description_bn": "নির্ভরযোগ্য তথ্য",
            "description_en": "",
            "ingredients": "",
            "source_url": "https://example.org/product/sku123",
            "local_image": "sku123.png",
            "image_credit": "Owner's own studio photograph",
            "product_approved": "yes",
            "image_rights_approved": "yes",
            "image_match_approved": "yes",
            "price_bdt": "1500",
            "price_verified": "no",
        }]
        (self.images / "sku123.png").write_bytes(PNG)

    def write_csv(self):
        with self.feed.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(self.rows[0]))
            w.writeheader()
            w.writerows(self.rows)

    def build(self):
        self.write_csv()
        return module.build_collection(self.root / "out", self.feed)

    def test_approved_item_has_real_local_image_no_checkout_or_fake_price(self):
        result, errors = self.build()
        self.assertFalse(errors)
        self.assertEqual(result["count"], 1)
        item = result["products"][0]
        self.assertIsNone(item["price_bdt"])
        self.assertFalse(item["purchasable"])
        self.assertTrue((self.root / "out/collection" / item["image"].removeprefix("./")).is_file())
        self.assertNotIn("stock", item)

    def test_unapproved_image_rights_never_published(self):
        self.rows[0]["image_rights_approved"] = "no"
        result, errors = self.build()
        self.assertEqual(result["count"], 0)
        self.assertTrue(errors)
        self.assertFalse((self.root / "out/collection/images").exists())

    def test_wrong_product_image_match_never_published(self):
        self.rows[0]["image_match_approved"] = ""
        result, _ = self.build()
        self.assertEqual(result["count"], 0)

    def test_path_traversal_never_copied(self):
        self.rows[0]["local_image"] = "../../secret.png"
        result, errors = self.build()
        self.assertEqual(result["count"], 0)
        self.assertTrue(errors)

    def test_verified_price_requires_valid_positive_bdt(self):
        self.rows[0]["price_verified"] = "yes"
        result, _ = self.build()
        self.assertEqual(result["products"][0]["price_bdt"], 1500.0)
        self.rows[0]["price_bdt"] = "Free!"
        result, errors = self.build()
        self.assertIsNone(result["products"][0]["price_bdt"])
        self.assertTrue(errors)

    def test_missing_input_creates_empty_safe_catalog(self):
        result, errors = module.build_collection(self.root / "out", self.root / "absent.csv")
        self.assertEqual(result["products"], [])
        self.assertEqual(errors, [])
        self.assertTrue((self.root / "out/collection/catalog.json").is_file())

if __name__ == "__main__":
    unittest.main()
