# Skill: /deploy

Build and deploy the application.

## Phases
1. **Gate** — Run bash .claude/scripts/gates.sh
2. **Build** — npm run build
3. **Preview** — npm run preview (verify build works)
4. **Deploy** — Deploy to target (TBD — Vercel, Netlify, or static host)

## Usage
```
/deploy
```
