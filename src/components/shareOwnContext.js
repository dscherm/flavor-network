import { createContext } from 'react';

/**
 * { userProfile, auth, nodes? } provided once by App (see OwnShare.jsx). Kept in its own module so a component that only
 * needs the signed-in uid (PictureView) does not import the whole share sheet.
 */
export const ShareOwnContext = createContext(null);
