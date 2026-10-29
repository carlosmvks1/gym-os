import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src import session


LIBRARY = {
    "Incline Dumbbell Press": {
        "rep_min": "6",
        "rep_max": "10",
        "load_increment_kg": "2.5",
    }
}

RULES = {
    "calibration": {
        "target_rir_min": 1,
        "target_rir_max": 3,
        "target_sets_for_medium_confidence": 2,
    }
}


class SessionTests(unittest.TestCase):
    def test_first_logged_set_immediately_starts_coaching(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "live_session.json"

            with (
                patch.object(session, "STATE_PATH", state_path),
                patch.object(session, "load_library", return_value=LIBRARY),
                patch.object(session, "load_rules", return_value=RULES),
            ):
                session.start_session("Calibration 01")
                item, result = session.add_set(
                    "Incline Dumbbell Press",
                    22.5,
                    10,
                    4,
                )

                self.assertEqual(item["set_number"], 1)
                self.assertEqual(result["action"], "increase_load")
                self.assertEqual(result["next_weight_kg"], 25.0)

    def test_finish_writes_to_private_log(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            state_path = root / "live_session.json"
            private_log = root / "private" / "training_log.csv"

            with (
                patch.object(session, "STATE_PATH", state_path),
                patch.object(session, "PRIVATE_LOG", private_log),
                patch.object(session, "load_library", return_value=LIBRARY),
                patch.object(session, "load_rules", return_value=RULES),
            ):
                session.start_session("Calibration 01")
                session.add_set("Incline Dumbbell Press", 25, 9, 2)
                count, saved_path = session.finish_session()

                self.assertEqual(count, 1)
                self.assertEqual(saved_path, private_log)
                self.assertTrue(private_log.exists())
                self.assertFalse(state_path.exists())


if __name__ == "__main__":
    unittest.main()
