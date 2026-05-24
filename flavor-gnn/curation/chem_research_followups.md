# Chemistry Research Follow-ups

Four botanicals flagged by the V3 research pass (2026-05-24) as worth
dedicated compound-data lookup before being added to `compounds.parquet`
and re-trained into the V3 pipeline. Each has a distinctive
single-compound signature that's lost to `alias` or `classify` shortcuts.

These four were intentionally **not** placed at a cluster centroid by
`apply_v3_assignments.py`; they remain in `ingredients.json` with the
gray fallback color (`#5a5a6b`) until their chemistry is ingested.

> **Provenance note**: WebFetch + WebSearch were both denied in this
> session. The compound assignments below are sourced from chemistry /
> flavor-science training knowledge and the PubChem CID column should
> be spot-checked at <https://pubchem.ncbi.nlm.nih.gov/compound/{CID}>
> before bulk ingestion. Where multiple CIDs exist for stereoisomers,
> the most-cited canonical form is listed.

---

## 1. Wormwood — *Artemisia absinthium*

**Family**: Asteraceae · **Form**: dried aerial parts / essential oil
**Culinary roles**: absinthe, vermouth, Chartreuse, gruit ale, herbal bitters

### Signature compounds

| Compound | PubChem CID | SMILES (canonical) | Role |
|----------|-------------|--------------------|------|
| α-thujone | 442728 | `O=C1CC2CC1C2(C)C(C)C` | Dominant bitter ketone, GABA-A antagonist; *the* defining note |
| β-thujone | 11653882 | `O=C1CC2CC1C2(C)C(C)C` (epimer) | Co-dominant with α; less neuroactive |
| absinthin | 442432 | C₃₀H₄₀O₆ (sesquiterpene lactone dimer) | The non-volatile bitter; survives distillation in fragments |
| cis-sabinyl acetate | 6453783 | `CC(=O)OC1(C2CC1(C)CC2)C(=C)C` | Aromatic top-note; camphor-spicy edge |
| 1,8-cineole (eucalyptol) | 2758 | `CC12CCC(CC1)CC(C)(C)O2` | Cooling, eucalyptus undertone |
| β-pinene | 14896 | `CC1=CCC2CC1C2(C)C` | Pine, peppery green |

### Expected GNN task profile (when added to compounds.parquet)

| Task | Expected probability | Reason |
|------|---------------------|--------|
| `bitter` | very high (≥0.85) | α-thujone + absinthin are textbook bitters |
| `odor_green` | high (~0.7) | β-pinene + sabinyl acetate |
| `odor_woody` | mid (~0.5) | terpene backbone |
| `odor_spicy` | mid (~0.4) | thujone + cineole cooling-pungent |
| `odor_floral` | low (~0.2) | minor |
| `sweet` | very low | dry, harsh palate |

### Expected pairings (cluster: **3 — Pantry & Sweeteners**)

Anise spirits (pernod, absinthe family — already classified in c3), gentian,
juniper, fennel, lemon balm, citrus peel, cardamom, hyssop, hops.
Strong negative pairing predicted with dairy (clashes with bitter intensity).

---

## 2. Yarrow — *Achillea millefolium*

**Family**: Asteraceae · **Form**: dried flowers / leaves
**Culinary roles**: gruit ale (pre-hop bittering agent, ~9th c.), Fernet-Branca and other amari, herbal teas, Iroquois traditional medicine

### Signature compounds

| Compound | PubChem CID | SMILES (canonical) | Role |
|----------|-------------|--------------------|------|
| chamazulene | 442345 | `CC1=C2C=C(C)C=C2C=CC1=C` (azulene) | The blue-pigmented sesquiterpene; bitter, slightly sweet |
| matricin | 5281768 | C₁₇H₂₂O₅ | Pro-chamazulene (heat-decomposes to chamazulene during distillation) |
| sabinene | 17100 | `CC(C)C12CCC(C1)C2=C` | Peppery, woody, citrus-pine |
| 1,8-cineole | 2758 | `CC12CCC(CC1)CC(C)(C)O2` | Eucalyptus, cooling |
| camphor | 2537 | `CC1(C)C2CCC1(C)C(=O)C2` | Camphor, sharp herbal |
| β-pinene | 14896 | `CC1=CCC2CC1C2(C)C` | Pine, fresh |
| achilleine | (alkaloid; FoodDB only) | C₂₀H₂₇NO₁₅ | Astringent, hemostatic |

### Expected GNN task profile

| Task | Expected probability | Reason |
|------|---------------------|--------|
| `bitter` | high (~0.75) | chamazulene + sesquiterpene matrix |
| `odor_woody` | very high (≥0.8) | sabinene + camphor + pinene dominate |
| `odor_green` | high (~0.7) | leaf-derived terpenes |
| `odor_spicy` | mid (~0.5) | camphor / cineole cooling pungency |
| `odor_floral` | mid (~0.4) | floral azulene undertone |
| `sweet` | low (~0.25) | subtle matricin sweetness |

### Expected pairings (cluster: **3 — Pantry & Sweeteners**)

Chamomile (cousin in Asteraceae, shares chamazulene), sage, mugwort,
ginger, mint, juniper, hops, citrus zest, gentian. Strong predicted
match with the wormwood pairing set — both share thujone-adjacent
bittering vocabulary.

---

## 3. Sarsaparilla — *Smilax ornata* / *S. regelii* / *S. aristolochiifolia*

**Family**: Smilacaceae · **Form**: dried root bark
**Culinary roles**: root beer, sarsaparilla soda, Mexican zarzaparrilla,
Caribbean herbal tonics, sassafras-substitute

### Signature compounds

| Compound | PubChem CID | SMILES (canonical) | Role |
|----------|-------------|--------------------|------|
| sarsapogenin | 99474 | C₂₇H₄₄O₃ (steroidal sapogenin) | Bitter saponin aglycone; root depth |
| smilagenin | 91454 | C₂₇H₄₄O₃ (epimer of sarsapogenin) | Co-dominant saponin |
| methyl salicylate | 4133 | `COC(=O)C1=CC=CC=C1O` | Wintergreen note; the "root beer" cue |
| coumarin | 323 | `O=C1C=Cc2ccccc2O1` | Vanilla-sweet hay, regulated as food additive |
| vanillin (trace) | 1183 | `COC1=C(C=CC(=C1)C=O)O` | Sweetness echo from lignin degradation |
| eugenol (trace) | 3314 | `COC1=CC(=CC=C1O)CC=C` | Clove-spicy depth |

### Expected GNN task profile

| Task | Expected probability | Reason |
|------|---------------------|--------|
| `odor_woody` | high (~0.75) | root steroid + lignin notes |
| `sweet` | mid (~0.55) | coumarin + vanillin trace |
| `bitter` | mid (~0.5) | saponins are bitter on the back palate |
| `odor_spicy` | mid (~0.4) | methyl salicylate + eugenol |
| `odor_green` | low (~0.25) | minor |
| `odor_fatty` | very low | not relevant |

### Expected pairings (cluster: **3 — Pantry & Sweeteners**)

Vanilla, wintergreen, anise, licorice, birch (methyl-salicylate cousin),
sassafras (in jurisdictions where legal), molasses, lime, ginger,
clove. Strong predicted match with root-beer-adjacent ingredient set.

---

## 4. Musk Mallow / Ambrette — *Abelmoschus moschatus*

**Family**: Malvaceae · **Form**: dried seeds
**Culinary roles**: perfumery (vegetable musk substitute for animal musk),
Indian Ayurveda, cocktail bitters, niche pastry flavoring

### Signature compounds

| Compound | PubChem CID | SMILES (canonical) | Role |
|----------|-------------|--------------------|------|
| ambrettolide | 5281882 | `O=C1CCCCCCCCCCC=CCCCO1` (16-membered macrocyclic lactone) | The macrocyclic musk; the defining note |
| (E,E)-farnesol | 445070 | `CC(=CCC/C(=C/CCC(=CCO)C)/C)C` | Floral-sweet, light citrus |
| (Z,E)-farnesyl acetate | 5354493 | C₁₇H₂₈O₂ | Sweet-woody floral |
| ambrettolic acid | (precursor) | C₁₆H₃₀O₃ | Lactone precursor; soapy, fatty |
| tetradecane | 12389 | `CCCCCCCCCCCCCC` | Long-chain alkane; bland fatty body |
| decanoic acid | 2969 | `CCCCCCCCCC(=O)O` | Coconut-fatty undertone |

### Expected GNN task profile

| Task | Expected probability | Reason |
|------|---------------------|--------|
| `odor_floral` | very high (≥0.8) | farnesol + farnesyl acetate dominate |
| `odor_fatty` | high (~0.65) | ambrettolide macrocyclic + decanoic acid |
| `sweet` | mid (~0.5) | farnesol's honeyed character |
| `odor_fruity` | mid (~0.4) | pear-like nuance from ambrettolide |
| `odor_woody` | low (~0.3) | minor terpene backbone |
| `bitter` | very low | not relevant |

### Expected pairings (cluster: **1 — Sweet Desserts & Dairy**)

Vanilla, rose, bergamot, jasmine, sandalwood, neroli, honey, coconut
(decanoic-acid cousin), pear, peach, cardamom. Predicted to bridge the
floral and dairy/fat surfaces — useful for desserts and custards.

---

## Implementation roadmap

To bring these 4 into the V3 cluster pipeline:

1. **Source SMILES / CIDs**. Validate every CID above at
   <https://pubchem.ncbi.nlm.nih.gov/compound/{CID}> — particularly the
   sesquiterpene lactones (absinthin, matricin) which have multiple
   numbering conventions.

2. **Extend the ingestion script**. Add a new script (suggested:
   `chemDataset/scripts/09-fetch-botanicals.js`) that:
   - For each of the 4 ingredients, writes one row per signature compound
     to `chemDataset/processed/botanicals.csv`
   - Each row: `ingredient_name, compound_name, smiles, pubchem_cid,
     contribution_weight, source='manual-botanicals-2026-05'`
   - Contribution weights: dominant compound = 1.0, co-dominants ≈ 0.6,
     traces ≈ 0.2 (matches the FlavorDB convention)

3. **Re-merge into compounds.parquet**. The existing
   `08-fetch-fartdb.js` + `chemDataset` orchestrator should pick up the
   new CSV. Confirm dedup-by-canonical-SMILES still works.

4. **Add to alias map as canonicals**. Each of the 4 ingredient names
   needs to appear in `v3_alias_map.json` as a self-canonical entry, so
   the V3 derive step keeps them rather than aliasing them away.

5. **Re-run V3 pipeline**:
   ```bash
   flavor-gnn/.venv/Scripts/python flavor-gnn/scripts/derive_long_tail.py
   flavor-gnn/.venv/Scripts/python train/train_gnn.py --csv flavor-gnn/curation/flavor_graph_full.csv
   flavor-gnn/.venv/Scripts/python flavor-gnn/scripts/impute_hub_embeddings.py
   flavor-gnn/.venv/Scripts/python flavor-gnn/scripts/flavor_layout_v3.py
   ```

6. **Verify**. After re-running the pipeline, the 4 names should appear in
   `cluster_labels_v3.json.ingredients` with cluster ids matching the
   "Expected pairings" line above (3, 3, 3, 1). If they land elsewhere,
   the chemistry is doing the talking — investigate before overriding.

## Why these four and not the other 70 unaliased items?

These four sit at the **intersection of three properties** that make
chem_add worth the effort:

1. **Single-compound dominance** — each has 1–2 compounds that account
   for >50% of the aroma signature. Most other unaliased items
   (galliano, jägermeister) are *blends* whose signature is the blend
   itself, not the constituents.

2. **No close V3 canonical exists** — wormwood / yarrow / sarsaparilla
   / ambrette don't have a "fold into X" target. The other 70 either
   had a clean alias (`creme de cacao → chocolate liqueur`) or fit
   cleanly into a cluster centroid (`mackerel → cluster 4`).

3. **Predictive value for chef workflow** — these four are gateway
   ingredients for entire flavor families (bitters, gruit, root beer,
   perfumed pastry). Getting them in V3 unlocks pairing predictions
   for adjacent items that *aren't* yet in the corpus.

The other 25 classified items got cluster-centroid placement without
chemistry because their pairing data via existing edges is enough — the
cluster centroid + edge embeddings produces a reasonable position.
These 4 don't have enough edges in `pairings.json` to anchor them, so
they need the chemistry path instead.
