#!/usr/bin/env python3
"""
verify_chemistry.py — A linter for the chemistry layer.

ANALOGY
-------
Think of this like ESLint for JavaScript or mypy for Python. It doesn't fix
anything. It walks through `chemistry_notes` for every row, recognizes the
compound names mentioned, and tells you where the gaps are:

  - VERIFIED  : compound has a PubChem CID in our registry
  - CLASS     : "pyrazines", "tannins", "fatty acids" - generic class names
                that legitimately can't have a single CID
  - CANDIDATE : looks like a real compound name, no CID yet (the to-do list)

It produces two outputs:
  - `chemistry_audit.csv`    a per-row breakdown of what was recognized
  - console summary          top-N most-frequent unverified candidates,
                             which is your prioritized list for the next
                             round of PubChem lookups

WHY A LINTER PATTERN
--------------------
Three reasons separating "audit" from "fix" matters here:

  1. Honesty boundary. If add_cids.py both detected gaps AND filled them, a
     bug in detection would silently fabricate CIDs. Splitting them means
     the fixer can ONLY act on a hand-verified dict; the detector can be
     buggy but never makes anything up.

  2. Future-proofing. Every time you add a new ingredient, run this script.
     It will yell about new compounds you mentioned but never looked up.
     The dataset self-reports its own incompleteness.

  3. Open feedback loop. The console output is literally "here is the most
     valuable next batch to verify, sorted by how many rows it would help."
     Future-you, or a future curator, has a backlog generated from the data
     itself, not from someone's memory.

EXTENDING
---------
- New verified CID  →  add to VERIFIED_CIDS in add_cids.py
- New generic class →  add to CLASSES set below
- New noise word    →  add to STOPWORDS set below

Run:  python3 verify_chemistry.py [csv_path]
"""
import csv, re, sys
from collections import Counter
from add_cids import VERIFIED_CIDS


# ---------------------------------------------------------------------------
# CLASSES — generic terms that name a CHEMICAL CLASS, not a single compound.
# These legitimately have no single CID and should NOT be flagged as gaps.
# ---------------------------------------------------------------------------
CLASSES = {
    "pyrazines", "maillard pyrazines", "maillard reaction products",
    "maillard sugars", "maillard volatiles",
    "tannins", "ellagitannins", "polyphenols",
    "anthocyanins", "carotenoids", "apocarotenoids",
    "esters", "ethyl esters", "passion-fruit esters", "passion fruit esters",
    "fruity esters", "isoamyl/ethyl esters",
    "lactones", "macrocyclic lactones",
    "methyl ketones", "ketones",
    "fatty acids", "free fatty acids", "omega fatty acids",
    "omega-3 lipids", "omega-3 fatty acids", "omega-3",
    "branched-chain fatty acids", "branched-chain fas",
    "volatile amines", "amines",
    "furans", "furanones",
    "alpha acids",
    "nucleotides",
    "saponins",
    "glucosinolates",
    "isothiocyanates",
    "glycosides",
    "terpenes", "monoterpenes", "sesquiterpenes", "terpenoids",
    "ionones",
    "phenolics",
    "smoke phenols",
    "sulfur volatiles", "sulfur thiols", "sulfur compounds",
    "organosulfur compounds", "organosulfur",
    "disulfides",
    "theaflavins", "thearubigins",
    "anthocyanin pigments",
    "color carotenoids",
}

# ---------------------------------------------------------------------------
# STOPWORDS — prose noise that survives tokenization but means nothing.
# Substring match (lowercase), checked against tokenized candidates.
# ---------------------------------------------------------------------------
STOPWORDS = {
    "dominant", "confidence", "low", "medium", "high",
    "taste", "gnn", "default", "needs", "human", "review",
    "composite", "verify",
    "color", "racemic", "concentrated", "(color)",
    "umami synergy", "(umami synergy)", "(when grilled)",
    "free", "the", "of", "in", "with", "and", "or", "was",
    "anise-herbal", "maple/curry lactone",
    "warm clove cinnamon nutmeg facet", "warm clove/cinnamon/nutmeg facet",
    "anise-herbal lactone",
}

# Strip out "(PubChem CID 3314)" and the "; CIDs: ..." trailer from add_cids
CID_PAREN_RE   = re.compile(r"\(\s*PubChem\s*CID[^)]*\)", re.I)
CID_TRAILER_RE = re.compile(r";?\s*CIDs:\s*[^;]*$", re.I)


def normalize(text: str) -> str:
    """Strip CID metadata so it doesn't pollute compound detection."""
    if not text:
        return ""
    text = CID_TRAILER_RE.sub("", text)
    text = CID_PAREN_RE.sub("", text)
    return text


def looks_like_compound(token: str) -> bool:
    """
    Heuristic: does this token plausibly name a chemical compound?
    We accept tokens that contain ANY of:
      - a digit (1,8-cineole, 6-gingerol, 2-acetyl-1-pyrroline)
      - greek-letter prefix written out (alpha-, beta-, gamma-, delta-)
      - cis/trans / (E)/(Z) stereo descriptor
      - common chemistry suffixes (acid, acetate, aldehyde, terpene, etc.)
    Rejects purely descriptive prose like "warm" or "savory".
    """
    if len(token) <= 2:
        return False
    patterns = [
        r"\d",                                        # 1,8-cineole, 6-gingerol
        r"\b(alpha|beta|gamma|delta)[-\s]",           # alpha-pinene
        r"\b(cis|trans)[-\s]",                        # cis-rose oxide
        r"\(\s*[ez]\b",                               # (E)-, (Z)-
        r"(acid|acetate|aldehyde|alcohol|terpene|"    # chemistry suffixes
        r"ester|lactone|pyraz|furan|thiol|"
        r"sulfide|sulphide|ketone|phenol|"
        r"olide|enal|enol|anal|anol|"
        r"yl |yl-|yl$)\b",
    ]
    return any(re.search(p, token, re.I) for p in patterns)


def audit_row(notes: str):
    """
    Returns (verified_hits, class_hits, candidate_tokens) for one row's chem note.

    The order matters: erase VERIFIED first (longest first), then CLASSES,
    then tokenize what's left. This handles compound names that contain commas
    like "1,8-cineole" — we extract them as whole units BEFORE splitting on `,`.
    """
    text = normalize(notes).lower()
    verified, classes_hit, candidates = [], [], []

    # 1) extract verified compounds, longest first (so "alpha-thujone" matches
    #    before any shorter prefix). Erase each match so it isn't re-counted.
    for name in sorted(VERIFIED_CIDS.keys(), key=len, reverse=True):
        n = name.lower()
        while n in text:
            text = text.replace(n, " ", 1)
            verified.append(name)

    # 2) same for class terms
    for cls in sorted(CLASSES, key=len, reverse=True):
        while cls in text:
            text = text.replace(cls, " ", 1)
            classes_hit.append(cls)

    # 3) flatten parens into delimiters so "estragole (methyl chavicol)"
    #    yields both halves cleanly
    text = text.replace("(", " , ").replace(")", " , ")

    # 4) split on common chem-notes delimiters
    for piece in re.split(r"[;,/+&]", text):
        # strip "dominant=", "confidence=", etc. on the left
        piece = re.sub(r"^\s*[a-z_-]+\s*=\s*", "", piece)
        piece = piece.strip(" '\"\t\n").strip()
        if not piece:
            continue
        if piece in STOPWORDS:
            continue
        if not looks_like_compound(piece):
            continue
        # candidates pass: looks like a real compound and we don't recognize it
        candidates.append(piece)

    return verified, classes_hit, candidates


def main(src: str, out: str = "chemistry_audit.csv"):
    with open(src, newline="") as f:
        rows = list(csv.reader(f))
    header, data = rows[0], rows[1:]
    chem_i = header.index("chemistry_notes")
    name_i = header.index("name")

    cand_counter = Counter()
    cand_to_rows = {}   # candidate -> example row names
    rows_report = []
    rows_with_chem = 0
    rows_fully_verified = 0
    rows_with_gaps = 0

    for r in data:
        name = r[name_i]
        notes = r[chem_i]
        verified, classes_hit, candidates = audit_row(notes)
        if not (verified or classes_hit or candidates):
            continue  # row has no real chemistry — skip
        rows_with_chem += 1
        if candidates:
            rows_with_gaps += 1
            for c in candidates:
                cand_counter[c] += 1
                cand_to_rows.setdefault(c, []).append(name)
        else:
            rows_fully_verified += 1
        rows_report.append([
            name,
            len(set(verified)),
            len(set(classes_hit)),
            len(set(candidates)),
            " | ".join(sorted(set(candidates))),
        ])

    # write per-row audit
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name", "verified_compounds", "class_terms",
                    "unverified_candidates", "candidate_list"])
        w.writerows(rows_report)

    # console summary
    print(f"audited file        : {src}")
    print(f"rows with chemistry : {rows_with_chem}")
    print(f"  fully verified    : {rows_fully_verified}")
    print(f"  with CID gaps     : {rows_with_gaps}")
    print(f"unique candidates   : {len(cand_counter)}")
    print()
    print("TOP-20 unverified candidates  (your next CID-lookup backlog):")
    print(f"  {'count':>5}  {'compound':40s}  {'example rows'}")
    for tok, cnt in cand_counter.most_common(20):
        examples = ", ".join(cand_to_rows[tok][:3])
        if len(cand_to_rows[tok]) > 3:
            examples += f" (+{len(cand_to_rows[tok]) - 3} more)"
        print(f"  {cnt:>5}  {tok:40s}  {examples}")

    print(f"\nFull per-row audit written to: {out}")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "draft_proposals_expanded_v4.csv"
    main(src)
