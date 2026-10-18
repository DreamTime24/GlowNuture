import csv
import tempfile
import unittest
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location

ROOT=Path(__file__).resolve().parents[1]
spec=spec_from_file_location("review_importer",ROOT/"scripts/prepare_client_catalog_from_csv.py")
converter=module_from_spec(spec)
spec.loader.exec_module(converter)

class CSVReviewTests(unittest.TestCase):
    def test_csv_import_requires_manual_approval_and_preserves_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            source=root/"original.csv"
            source.write_text("Product Name,Brand,Barcode,বাংলা Description,Product Source Link,BD Price ৳\nCaffeine Solution 5% + EGCG,The Ordinary,769915190670,সিরাম,https://example.com/item,799\n",encoding="utf-8")
            images=root/"images"
            images.mkdir()
            (images/"Caffeine Solution 5% + EGCG.jpg").write_bytes(b"placeholder")
            output=root/"review.csv"
            count,candidates=converter.create_review(source,output,images)
            self.assertEqual((count,candidates),(1,1))
            with output.open(encoding="utf-8-sig",newline="") as f:
                item=next(csv.DictReader(f))
            self.assertEqual(item["name"],"Caffeine Solution 5% + EGCG")
            self.assertEqual(item["local_image"],"Caffeine Solution 5% + EGCG.jpg")
            self.assertEqual(item["product_approved"],"no")
            self.assertEqual(item["image_rights_approved"],"no")
            self.assertEqual(item["image_match_approved"],"no")
            self.assertEqual(item["price_bdt"],"")
            self.assertEqual(item["price_verified"],"no")
            self.assertIn("799",source.read_text(encoding="utf-8"))
            with self.assertRaises(ValueError):
                converter.create_review(source,output,images)

if __name__=="__main__":
    unittest.main()
