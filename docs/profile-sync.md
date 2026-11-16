# Profile sync and removal markers (PROFILE-2)

The profile (`profiles/{uid}` in Firestore, `flavor-user-profile-v2` on the device) is merged at sign-in and before every
save by `mergeProfiles` in `src/data/profileMerge.js`. Code: `src/hooks/useUserProfile.js`.

| List | Identity | Item time | Removal recorded by |
|---|---|---|---|
| recipes | name, trimmed, lower-case | none | marker in `removed.recipes` |
| cocktails | `id` | `updatedAt` / `createdAt` if present | marker |
| sauces | `id` | `updatedAt` / `createdAt` if present | marker |
| cuisines, ingredients | the string | none | marker |
| favourite pairings | canonical pair (a < b) | none | marker |
| shares (public links) | `id` | `createdAt` | marker |
| shopping list | item `id` | `updatedAt` | its own `removed` (`shoppingStore.js`) |

`removed` is `{ list: { identity: removedAtMs } }`. Rule: union the two copies, then drop an item when a marker exists
that is not older than the item's own time; an item changed after its marker stays (and the marker goes). No time on the
item means the marker wins. Putting the same thing back clears its marker. Markers are made in one place (`withRemovals`,
called by every change in the hook, including Clear and a rename), so signed-out deletes are kept on the device and
applied at the next sign-in. They are kept 30 days, at most 400, newest first.

Stated limits: a device offline more than 30 days can bring a removed item back; saved cocktails and sauces carry only
`createdAt`, so an edit made after a deletion is not recognised as newer; the quiz answers are not part of the
pre-save merge (this device's win). Deleting a saved recipe does not unshare a link made from it.
