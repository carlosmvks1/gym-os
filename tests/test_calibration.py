import unittest

from src.calibration import adjust_load, recommend_next_set

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
    def test_cold_start_is_user_seeded(self):
        result = recommend_next_set("Incline Dumbbell Press", [], LIBRARY, RULES)
        self.assertEqual(result["action"], "user_selects_first_load")
        self.assertIsNone(result["next_weight_kg"])

    def test_increment_is_relative_not_snapped_to_global_multiples(self):
        self.assertEqual(adjust_load(22.5, 2.0, "up"), 24.5)
        self.assertEqual(adjust_load(22.5, 2.0, "down"), 20.5)

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
        self.assertFalse(result["calibrated"])

    def test_two_same_load_target_sets_provisionally_calibrate(self):
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
        self.assertTrue(result["should_stop"])
        self.assertEqual(result["confidence"]["label"], "medium")

    def test_valid_sets_at_different_loads_do_not_confirm_each_other(self):
        result = recommend_next_set(
            "Incline Dumbbell Press",
            [
                {"weight_kg": 22.5, "reps": 9, "rir": 2},
                {"weight_kg": 25, "reps": 8, "rir": 2},
            ],
            LIBRARY,
            RULES,
        )
        self.assertFalse(result["calibrated"])
        self.assertEqual(result["confirming_sets"], 1)

    def test_low_reps_with_high_rir_does_not_force_weight_reduction(self):
        result = recommend_next_set(
            "Incline Dumbbell Press",
            [{"weight_kg": 25, "reps": 5, "rir": 4}],
            LIBRARY,
            RULES,
        )
        self.assertEqual(result["action"], "hold_load")
        self.assertEqual(result["next_weight_kg"], 25)

    def test_above_rep_range_increases_even_if_user_hit_failure(self):
        result = recommend_next_set(
            "Incline Dumbbell Press",
            [{"weight_kg": 25, "reps": 15, "rir": 0}],
            LIBRARY,
            RULES,
        )
        self.assertEqual(result["action"], "increase_load")
        self.assertEqual(result["next_weight_kg"], 27.5)


if __name__ == "__main__":
    unittest.main()
