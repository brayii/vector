import json
import os
import stat
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PortabilityTests(unittest.TestCase):
    def test_root_npm_scripts_use_portable_python_launcher(self) -> None:
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        for command in (package["scripts"]["learning"], package["scripts"]["test"]):
            self.assertIn("scripts/run-python.cjs", command)
            self.assertNotIn("py -3.14", command)
        runner = (ROOT / "scripts" / "run-python.cjs").read_text(encoding="utf-8")
        self.assertLess(runner.index("['python3', []]"), runner.rindex("['python', []]"))

    def test_debian_launchers_are_executable_in_git_checkout(self) -> None:
        if os.name == "nt":
            self.skipTest("Windows does not expose repository executable bits")
        for name in ("start-vector.sh", "stop-vector.sh"):
            mode = (ROOT / name).stat().st_mode
            self.assertTrue(mode & stat.S_IXUSR, name)

    def test_runtime_files_are_ignored(self) -> None:
        ignored = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn(".vector-runtime.json", ignored)
        self.assertIn(".vector-runtime.pid", ignored)
        self.assertIn("*.log", ignored)

    def test_standalone_has_no_clone_specific_readme_path(self) -> None:
        source = (ROOT / "presence" / "lib" / "hangar-requirements.ts").read_text(
            encoding="utf-8"
        )
        self.assertIn("HANGAR_REQUIREMENTS_SOURCE = 'README.md'", source)
        self.assertNotIn("D:\\\\vector", source)


if __name__ == "__main__":
    unittest.main()
