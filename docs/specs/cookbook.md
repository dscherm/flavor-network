# cookbook as-built specs

## COOKBOOK-49 — Expand the Cookbook from 15 to 49 seed recipes

Add 34 recipes across the existing 7 cuisines and 4 dish types in src/data/seedRecipes.js, using ProData ingredient spellings. Subtitle counts recipes from data.

## COOKBOOK-NAMES-1 — Fix original seed-recipe ingredient names that don't resolve

ground beef, bell pepper, seaweed, chili pepper were absent from ProData and silently dropped out of flavor profiles; renamed to beef, sweet pepper, wakame, ancho chili.

## COOKBOOK-METHOD-1 — Quantities, servings, time and method steps for every Cookbook recipe

New src/data/seedRecipeDetails.js keyed by recipe id; the recipe popup shows 'Serves N · time', an amount beside each ingredient, and a numbered Method.

## COOKBOOK-PAIR-1 — 'Goes well with' cocktails and sauces from a Cookbook recipe

Recipe popup gets Matching cocktails / Matching sauces buttons that reuse App's aroma-match handlers; matchesContext carries returnTab so 'Back to recipe' returns to the Cookbook.

## COOKBOOK-83 — Cookbook 49 -> 83 recipes, adding American and Mediterranean

34 more recipes with servings, time, amounts and method; two new cuisines with colours.
