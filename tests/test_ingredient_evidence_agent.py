import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from ingredient_evidence_agent import derive_aliases, notice_slug, select_candidates  # noqa: E402


class IngredientEvidenceAgentTests(unittest.TestCase):
    def test_notice_slug(self):
        self.assertEqual(notice_slug("제2026-7호"), "2026-7")

    def test_strain_alias_is_more_specific_than_species(self):
        row = {"name": "Lacticaseibacillus paracasei ABF21013 프로바이오틱스"}
        aliases = derive_aliases(row, "", {})
        self.assertIn("Lacticaseibacillus paracasei ABF21013", aliases)

    def test_strict_auto_requires_human_and_animal_open_pdfs(self):
        candidates = [
            {"pmid": "1", "studyType": "clinical", "identifierHits": ["ABC01"], "openAccessPdf": True},
            {"pmid": "2", "studyType": "animal", "identifierHits": ["ABC01"], "openAccessPdf": True},
        ]
        selected, decision = select_candidates(candidates, {}, auto=True)
        self.assertEqual(decision, "strict_auto")
        self.assertEqual(len(selected), 2)

    def test_manual_approval_still_requires_both_study_types(self):
        candidates = [
            {"pmid": "1", "studyType": "clinical", "identifierHits": [], "openAccessPdf": True},
        ]
        selected, decision = select_candidates(
            candidates,
            {"approvedPmids": {"clinical": ["1"], "animal": []}},
            auto=False,
        )
        self.assertEqual(selected, [])
        self.assertEqual(decision, "approved_study_type_missing")


if __name__ == "__main__":
    unittest.main()
