#!/usr/bin/env python3
"""
add_cids.py — Append verified PubChem CIDs to chemistry_notes.

WHY A POST-PROCESSOR (NOT EDIT THE AUTHORING FILE)
--------------------------------------------------
Authoring (what compound dominates this ingredient) and identification
(what's the registry number for that compound) are two different jobs that
should fail independently. If a PubChem CID is wrong, we fix it here without
touching the chemistry-judgment file. If the compound assignment is wrong,
we fix it in build_chunks.py without re-doing all the lookups.

Each CID below was verified by a live PubChem/Wikipedia search this session.
"""
import csv, sys, re

# 59 CIDs verified live this session against PubChem/Wikipedia infoboxes.
# Phase A (initial 25) + Phase 4 (added 34 more) — all checked, no memory guesses.
VERIFIED_CIDS = {
    # Phase A — most-central single compounds
    "eugenol":               3314,
    "estragole":             8815,   # also "methyl chavicol"
    "methyl chavicol":       8815,
    "vanillin":              1183,
    "cinnamaldehyde":        637511,
    "linalool":              6549,
    "limonene":              22311,  # racemic; D-limonene is 440917
    "menthol":               16666,  # racemic
    "thymol":                6989,
    "carvacrol":             10364,
    "eucalyptol":            2758,
    "1,8-cineole":           2758,
    "carvone":               7439,
    "geraniol":              637566,
    "terpinen-4-ol":         11230,
    "citral":                638011, # alpha/geranial; beta/neral 643779
    "coumarin":              323,
    "sotolone":              62835,
    "furaneol":              19309,
    "methyl salicylate":     4133,
    "allyl isothiocyanate":  5971,
    "allicin":               65036,
    "2-acetyl-1-pyrroline":  522834,
    "maltol":                8369,
    "chamazulene":           10719,
    "guaiacol":              460,
    "alpha-thujone":         12304612, # (+)-isomer
    # Phase 4 — additional aromatic terpenes / lactones / phenols
    "anethole":              637563,
    "alpha-pinene":          6654,
    "beta-pinene":           14896,
    "camphor":               2537,
    "fenchone":              14525,
    "myristicin":            4276,
    "sabinene":              18818,
    "1-octen-3-ol":          18827,
    "isoamyl acetate":       31276,
    "benzaldehyde":          240,
    "linalyl acetate":       8294,
    "gamma-decalactone":     12813,
    "gamma-nonalactone":     7710,
    "methional":             18635,
    "piperine":              638024,
    "curcumin":              969516,
    "citronellal":           7794,
    "citronellol":           8842,
    "safranal":              61041,
    "nootkatone":            1268142,
    "thymoquinone":          10281,
    "raspberry ketone":      21648,
    "beta-damascenone":      5366074,
    "jasmone":               1549018,
    "bisabolol":             10586,
    "methyl anthranilate":   8635,
    "benzyl acetate":        8785,
    "indole":                798,
    "hydroxy-alpha-sanshool":10084135,
    "diallyl disulfide":     16590,
    # Phase 4 — umami compounds (high payoff, many rows)
    "glutamate":             33032,   # L-glutamic acid (free form)
    "l-glutamic acid":       33032,
    "inosinate":             8582,    # IMP / inosinic acid
    "l-theanine":            439378,
    # Phase 5/6 — pungency compounds, aldehydes, GMP/guanylate
    "6-gingerol":            442793,
    "6-shogaol":             5281794,
    "shogaol":               5281794,
    "beta-thujone":          91456,    # the SMILES-dedup-trap partner of alpha
    "guanylate":             135398631, # GMP / guanosine monophosphate
    "guanosine monophosphate":135398631,
    "propanethial s-oxide":  441491,    # the onion lacrimator
    # Phase 5/6 — color carotenoids & bitter glycosides
    "capsanthin":            5281228,
    "bixin":                 5281226,
    "amarogentin":           115149,
    # Phase 5/6 — green leaf volatiles & C9 aldehydes (cucumber/melon/cilantro lineage)
    "(e)-2-hexenal":         5281168,
    "(z)-3-hexenal":         643941,
    "(e,e)-2,4-decadienal":  5283349,
    "octanal":               454,
    "decanal":               8175,
    "(e)-2-decenal":         5283345,
    "(e)-2-nonenal":         5283335,
    "(e,z)-2,6-nonadienal":  643731,
    "(z)-6-nonenal":         5362720,   # cantaloupe melon aldehyde
}

# Longest names first so "1,8-cineole" matches before "cineole" (no overlap here but the
# rule is good practice — same logic as why a tokenizer goes longest-match-first).
ORDERED = sorted(VERIFIED_CIDS.keys(), key=len, reverse=True)

def annotate(notes: str) -> str:
    if not notes:
        return notes
    found = {}
    low = notes.lower()
    for name in ORDERED:
        if name in low:
            cid = VERIFIED_CIDS[name]
            # Dedup against BOTH formats this annotator might encounter:
            # (a) "CID <num>" — the legacy in-prose format the original tool emitted
            # (b) "name=<num>" — the chef's existing trailer format (chef ran an
            #     earlier version of add_cids that emitted "estragole=8815, ...";
            #     re-running the tool against that file would dupe the trailer
            #     because the literal "CID 8815" string isn't present)
            # (c) "(PubChem CID <num>)" — yet another in-prose format
            if (f"CID {cid}" in notes
                    or f"={cid}" in low
                    or f"cid {cid}" in low):
                continue
            found[name] = cid
    if not found:
        return notes
    # stable order: by compound name
    trailer = "CIDs: " + ", ".join(f"{n}={c}" for n,c in sorted(found.items()))
    sep = "; " if not notes.rstrip().endswith(";") else " "
    return notes.rstrip() + sep + trailer


def main(src, dst):
    with open(src, newline="") as f:
        rows = list(csv.reader(f))
    header, data = rows[0], rows[1:]
    chem_i = header.index("chemistry_notes")

    annotated = 0
    for r in data:
        new = annotate(r[chem_i])
        if new != r[chem_i]:
            annotated += 1
            r[chem_i] = new

    with open(dst, "w", newline="") as f:
        w = csv.writer(f); w.writerow(header); w.writerows(data)
    print(f"{src} -> {dst}")
    print(f"  rows annotated with verified CIDs: {annotated}")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv)>1 else "draft_proposals_expanded.csv"
    dst = sys.argv[2] if len(sys.argv)>2 else "draft_proposals_expanded_v2.csv"
    main(src, dst)
