# fb as-built specs

## FB-PURGE-1 — Remove copyrighted Flavor Bible data from the repo, its history and the live site

data/flavor_bible_full.csv and public/proDataset/flavor_bible_matched.json (and the older public/data/flavor_bible_full.csv) held The Flavor Bible's pairing lists in a public repo and on the live site. They move to git-ignored data/private/ for local evaluation only; scripts read from there; the app no longer loads the curated layer (empty set -> no 📖 badges, no 'Also in The Flavor Bible' list, no ★★ floor). History rewritten on every branch and tag and force-pushed; site redeployed. Kept: proDataset/scripts/13-build-chef-citations.js (37 individually cited pairs, 4 from the book).
