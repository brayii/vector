import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTINUE = ROOT / ".continue"


class ContinueWorkspaceConfigTests(unittest.TestCase):
    def test_extension_is_recommended(self) -> None:
        recommendations = json.loads(
            (ROOT / ".vscode" / "extensions.json").read_text(encoding="utf-8")
        )["recommendations"]
        self.assertIn("continue.continue", [item.lower() for item in recommendations])

    def test_rule_is_always_applied_and_runs_lifecycle(self) -> None:
        rule = (CONTINUE / "rules" / "01-project-instructions.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("alwaysApply: true", rule)
        self.assertIn("lifecycle.py pre-task", rule)
        self.assertIn("lifecycle.py post-task", rule)
        self.assertIn("AGENTS.md", rule)

    def test_local_model_has_required_agent_configuration(self) -> None:
        model = (CONTINUE / "models" / "vector-local.yaml").read_text(
            encoding="utf-8"
        )
        required_fragments = (
            "schema: v1",
            "provider: ollama",
            "model: qwen3:4b",
            "apiBase: http://127.0.0.1:11434",
            "- chat",
            "- edit",
            "- apply",
            "- autocomplete",
            "- tool_use",
        )
        for fragment in required_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, model)


if __name__ == "__main__":
    unittest.main()
