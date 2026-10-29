import unittest

from src.calibration import recommend_next_set


LIBRARY = {
    "Incline Dumbbell Press": {
        "rep_min": "6",
        "rep_max": "10",
        "load_increment_kg": "2.5",
    }
}

RULES = {
    "target_rir_min": 1,
    "target_rir_max": 3,
    "calibration": {
        "target_rir_min": 1,
        "target_rir_max": 3,
        "target_sets_for_medium_confidence": 2,
    },
}


class CalibrationTests(unittest.TestCase):
    def test_too_easy_increases_load(self):
        result = recommend_next_set(
            "Incline Dumbbell Press",
            [{"weight_kg": 22.5, "reps": 10, "rir": 4}],
            LIBRARY,
            RULES,
        )
        self.assertEqual(result["action"], "increase_load")
        self.assertEqual(result["next_weight_kg"], 25.0)

    def test_target_set_holds_load(self):
        result = recommend_next_set(
            "Incline Dumbbell Press",
            [{"weight_kg": 25, "reps": 9, "rir": 2}],
            LIBRARY,
            RULES,
        )
        self.assertEqual(result["action"], "hold_load")
        self.assertEqual(result["next_weight_kg"], 25.0)
        self.assertFalse(result["calibrated"])

    def test_two_target_sets_provisionally_calibrate(self):
        result = recommend_next_set(
            "Incline Dumbbell Press",
            [
                {"weight_kg": 25, "reps": 9, "rir": 2},
                {"weight_kg": 25, "reps": 8, "rir": 1},
            ],
            LIBRARY,
            RULES,
        )
        self.assertTrue(result["calibrated"])
        self.assertEqual(result["confidence"]["label"], "medium")

    def test_too_hard_decreases_load(self):
        result = recommend_next_set(
            "Incline Dumbbell Press",
            [{"weight_kg": 25, "reps": 5, "rir": 1}],
            LIBRARY,
            RULES,
        )
        self.assertEqual(result["action"], "decrease_load")
        self.assertEqual(result["next_weight_kg"], 22.5)


if __name__ == "__main__":
    unittest.main()
