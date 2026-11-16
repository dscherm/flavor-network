// PICTURE-3. Firestore rules for the two picture locations and the optional `picture` key on shared/{id}:
//   profiles/{uid}/pictures/{itemId}   the owner's own chalk picture of a saved item
//   sharedPictures/{shareId}           the chalk picture of a shared copy
// Runs against the LOCAL Firestore emulator only, under a demo- project id: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const ID = 'abcdefghjk';
const OWNER = 'owner-uid';
const OTHER = 'other-uid';
const ITEM = 'inv-lx2k9-ab12cd';

let env;
const asOwner = () => env.authenticatedContext(OWNER).firestore();
const asOther = () => env.authenticatedContext(OTHER).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const pic = (over = {}) => ({ data: 'QUJD'.repeat(100), mime: 'image/jpeg', w: 600, h: 450, updatedAt: Date.now(), ...over });
const sharePic = (over = {}) => ({ data: 'QUJD'.repeat(100), mime: 'image/jpeg', w: 600, h: 450, owner: OWNER, createdAt: Date.now(), ...over });
const share = (over = {}) => ({
  kind: 'cocktail',
  name: 'Grandma Sour',
  lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon juice', amount: '1 oz' }],
  bars: [],
  by: null,
  owner: OWNER,
  createdAt: Date.now(),
  removed: false,
  picture: { kind: 'chalk' },
  ...over,
});
const seedShare = async (data = share(), id = ID) => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'shared', id), data); });
};
const seedSharePic = async (data = sharePic(), id = ID) => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'sharedPictures', id), data); });
};
const seedProfilePic = async (data = pic()) => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'profiles', OWNER, 'pictures', ITEM), data); });
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-neuralflavor-pictures',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('profiles/{uid}/pictures/{itemId}', () => {
  it('lets the owner write, read, replace and delete their own picture', async () => {
    const ref = doc(asOwner(), 'profiles', OWNER, 'pictures', ITEM);
    await assertSucceeds(setDoc(ref, pic()));
    await assertSucceeds(getDoc(ref));
    await assertFails(setDoc(ref, pic({ mime: 'image/webp' })));
    await assertSucceeds(deleteDoc(ref));
  });
  it('denies another user reading, writing or deleting it', async () => {
    await seedProfilePic();
    const ref = doc(asOther(), 'profiles', OWNER, 'pictures', ITEM);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, pic()));
    await assertFails(deleteDoc(ref));
    await assertFails(getDocs(collection(asOther(), 'profiles', OWNER, 'pictures')));
  });
  it('denies signed out', async () => {
    await seedProfilePic();
    const ref = doc(anon(), 'profiles', OWNER, 'pictures', ITEM);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, pic()));
  });
  it('denies a user writing under someone else\'s profile', async () => {
    await assertFails(setDoc(doc(asOwner(), 'profiles', OTHER, 'pictures', ITEM), pic()));
  });
  it('denies an oversize data string, accepts one just under the cap', async () => {
    const ref = doc(asOwner(), 'profiles', OWNER, 'pictures', ITEM);
    await assertFails(setDoc(ref, pic({ data: 'A'.repeat(210000) })));
    await assertSucceeds(setDoc(ref, pic({ data: 'A'.repeat(209999) })));
  });
  it('denies a wrong mime, an empty or non-string data, and bad dimensions', async () => {
    const ref = doc(asOwner(), 'profiles', OWNER, 'pictures', ITEM);
    for (const bad of [
      { mime: 'image/png' }, { mime: 'text/html' }, { data: '' }, { data: 5 },
      { w: 0 }, { w: 15 }, { w: 2001 }, { h: 0 }, { h: 2001 }, { w: 600.5 }, { w: '600' }, { updatedAt: 'now' },
    ]) {
      await assertFails(setDoc(ref, pic(bad)));
    }
  });
  it('denies an extra key and a missing key', async () => {
    const ref = doc(asOwner(), 'profiles', OWNER, 'pictures', ITEM);
    await assertFails(setDoc(ref, pic({ original: 'x' })));
    for (const k of ['data', 'mime', 'w', 'h', 'updatedAt']) {
      const d = pic();
      delete d[k];
      await assertFails(setDoc(ref, d));
    }
  });
  it('denies an item id that is not a plain id', async () => {
    await assertFails(setDoc(doc(asOwner(), 'profiles', OWNER, 'pictures', 'a b'), pic()));
    await assertFails(setDoc(doc(asOwner(), 'profiles', OWNER, 'pictures', 'x'.repeat(81)), pic()));
  });
  it('leaves the profile document rule as it was', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'profiles', OWNER), { recipes: [] }));
    await assertFails(setDoc(doc(asOther(), 'profiles', OWNER), { recipes: [] }));
  });
});

describe('sharedPictures/{id}: reading', () => {
  it('lets anyone get the picture of a live share, signed out too', async () => {
    await seedShare();
    await seedSharePic();
    await assertSucceeds(getDoc(doc(anon(), 'sharedPictures', ID)));
    await assertSucceeds(getDoc(doc(asOther(), 'sharedPictures', ID)));
  });
  it('lets nobody list the collection', async () => {
    await seedShare();
    await seedSharePic();
    await assertFails(getDocs(collection(anon(), 'sharedPictures')));
    await assertFails(getDocs(collection(asOwner(), 'sharedPictures')));
  });
  it('after the share is removed: denied to anyone else, still readable by the owner', async () => {
    await seedShare(share({ removed: true }));
    await seedSharePic();
    await assertFails(getDoc(doc(anon(), 'sharedPictures', ID)));
    await assertFails(getDoc(doc(asOther(), 'sharedPictures', ID)));
    await assertSucceeds(getDoc(doc(asOwner(), 'sharedPictures', ID)));
  });
  it('denies a picture whose share does not exist', async () => {
    await seedSharePic();
    await assertFails(getDoc(doc(anon(), 'sharedPictures', ID)));
  });
});

describe('sharedPictures/{id}: create', () => {
  it('allows the owner to write the share and its picture in one batch', async () => {
    const db = asOwner();
    const b = writeBatch(db);
    b.set(doc(db, 'shared', ID), share());
    b.set(doc(db, 'sharedPictures', ID), sharePic());
    await assertSucceeds(b.commit());
  });
  it('allows the picture after the share, in a separate write', async () => {
    await seedShare();
    await assertSucceeds(setDoc(doc(asOwner(), 'sharedPictures', ID), sharePic()));
  });
  it('denies signed out', async () => {
    await seedShare();
    await assertFails(setDoc(doc(anon(), 'sharedPictures', ID), sharePic()));
  });
  it('denies another user, whether or not they put themselves down as owner', async () => {
    await seedShare();
    await assertFails(setDoc(doc(asOther(), 'sharedPictures', ID), sharePic()));
    await assertFails(setDoc(doc(asOther(), 'sharedPictures', ID), sharePic({ owner: OTHER })));
  });
  it('denies a picture for a share that does not exist', async () => {
    await assertFails(setDoc(doc(asOwner(), 'sharedPictures', ID), sharePic()));
  });
  it('denies a picture for a removed share', async () => {
    await seedShare(share({ removed: true }));
    await assertFails(setDoc(doc(asOwner(), 'sharedPictures', ID), sharePic()));
  });
  it('denies a picture when the share does not declare a chalk picture', async () => {
    const noPic = share();
    delete noPic.picture;
    await seedShare(noPic);
    await assertFails(setDoc(doc(asOwner(), 'sharedPictures', ID), sharePic()));
    await seedShare(share({ picture: { kind: 'icon', icon: 'glass:coupe' } }));
    await assertFails(setDoc(doc(asOwner(), 'sharedPictures', ID), sharePic()));
  });
  it('denies oversize, wrong mime, bad dimensions, an extra key and a missing key', async () => {
    await seedShare();
    const ref = doc(asOwner(), 'sharedPictures', ID);
    await assertFails(setDoc(ref, sharePic({ data: 'A'.repeat(210000) })));
    for (const bad of [{ mime: 'image/gif' }, { mime: 'image/webp' }, { w: 8 }, { h: 2500 }, { data: '' }, { extra: 1 }]) {
      await assertFails(setDoc(ref, sharePic(bad)));
    }
    const d = sharePic();
    delete d.owner;
    await assertFails(setDoc(ref, d));
    await assertSucceeds(setDoc(ref, sharePic({ data: 'A'.repeat(209999) })));
  });
  it('denies a malformed share id', async () => {
    await seedShare(share(), 'short');
    await assertFails(setDoc(doc(asOwner(), 'sharedPictures', 'short'), sharePic()));
  });
});

describe('sharedPictures/{id}: update and delete', () => {
  it('denies every update, even by the owner', async () => {
    await seedShare();
    await seedSharePic();
    await assertFails(setDoc(doc(asOwner(), 'sharedPictures', ID), sharePic({ w: 700 })));
    await assertFails(updateDoc(doc(asOwner(), 'sharedPictures', ID), { w: 700 }));
  });
  it('lets the owner delete, and nobody else', async () => {
    await seedShare();
    await seedSharePic();
    await assertFails(deleteDoc(doc(anon(), 'sharedPictures', ID)));
    await assertFails(deleteDoc(doc(asOther(), 'sharedPictures', ID)));
    await assertSucceeds(deleteDoc(doc(asOwner(), 'sharedPictures', ID)));
  });
  it('lets the owner delete after the share was removed (unshare clean-up)', async () => {
    await seedShare(share({ removed: true }));
    await seedSharePic();
    await assertSucceeds(deleteDoc(doc(asOwner(), 'sharedPictures', ID)));
  });
  it('treats deleting a picture that was never written as a harmless no-op for a signed-in user', async () => {
    await seedShare();
    await assertSucceeds(deleteDoc(doc(asOwner(), 'sharedPictures', ID)));
    await assertFails(deleteDoc(doc(anon(), 'sharedPictures', ID)));
  });
});

describe('shared/{id}: the optional picture key', () => {
  const create = (data) => setDoc(doc(asOwner(), 'shared', ID), data);
  const without = (d) => { const o = { ...d }; delete o.picture; return o; };
  it('accepts a document without picture (older documents stay valid)', async () => {
    await assertSucceeds(create(without(share())));
  });
  it('accepts a chalk picture and an icon picture', async () => {
    await assertSucceeds(create(share({ picture: { kind: 'chalk' } })));
    await env.clearFirestore();
    await assertSucceeds(create(share({ picture: { kind: 'icon', icon: 'glass:flute' } })));
  });
  it('denies a malformed picture', async () => {
    for (const bad of [
      'chalk', null, 5, [], {},
      { kind: 'photo' }, { kind: 'icon' }, { kind: 'icon', icon: '' }, { kind: 'icon', icon: 7 },
      { kind: 'icon', icon: 'x'.repeat(41) }, { kind: 'chalk', icon: 'glass:flute' }, { kind: 'chalk', data: 'AAAA' },
      { kind: 'icon', icon: 'glass:flute', data: 'AAAA' }, { icon: 'glass:flute' },
    ]) {
      await assertFails(create(share({ picture: bad })));
    }
  });
  it('still lets the owner unshare a share that has a picture, and nothing else change', async () => {
    await seedShare();
    await assertSucceeds(updateDoc(doc(asOwner(), 'shared', ID), { removed: true }));
    await assertFails(updateDoc(doc(asOwner(), 'shared', ID), { picture: { kind: 'icon', icon: 'glass:coupe' } }));
  });
});
