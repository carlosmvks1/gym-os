import csv
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ConfigParityTests(unittest.TestCase):
    def test_pwa_exercises_match_canonical_library(self):
        with (ROOT / "data" / "exercise_library.csv").open(newline="", encoding="utf-8") as f:
            canonical = {r["exercise"]: r for r in csv.DictReader(f) if r.get("exercise")}

        pwa = {
            r["exercise"]: r
            for r in json.loads((ROOT / "docs" / "exercises.json").read_text(encoding="utf-8"))
        }

        self.assertEqual(set(canonical), set(pwa))
        for exercise, row in canonical.items():
            self.assertEqual(row["primary_muscle"], pwa[exercise]["primaryMuscle"], exercise)
            self.assertEqual(row["pattern"], pwa[exercise]["pattern"], exercise)
            self.assertEqual(int(row["rep_min"]), int(pwa[exercise]["repMin"]), exercise)
            self.assertEqual(int(row["rep_max"]), int(pwa[exercise]["repMax"]), exercise)
            self.assertAlmostEqual(
                float(row["load_increment_kg"]),
                float(pwa[exercise]["increment"]),
                msg=exercise,
            )


if __name__ == "__main__":
    unittest.main()
