import { useEffect, useState } from 'react';
import { getConsent, setConsent, subscribeConsent } from '../data/usage.js';
import { EVENTS, TEXT_MAX } from '../data/usageEvents.js';

const box = { maxWidth: 640, margin: '0 auto', padding: '24px 16px 48px', boxSizing: 'border-box' };
const h2 = { fontSize: 17, fontWeight: 600, margin: '22px 0 6px' };

export default function PrivacyPage() {
  const [answer, setAnswer] = useState(() => getConsent());
  useEffect(() => subscribeConsent((v) => setAnswer(v)), []);
  const on = answer === 'yes';
  return (
    <main data-testid="privacy-page" style={{ minHeight: '100vh', background: '#16201c', color: '#f1efe6', lineHeight: 1.5, fontSize: 15 }}>
      <div style={box}>
        <a href="/" style={{ color: '#9ed8b8', fontSize: 14, display: 'inline-block', minHeight: 44, lineHeight: '44px' }}>&larr; Back to Neural Flavor</a>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 8px' }}>Privacy</h1>
        <p>
          Neural Flavor can count how the app is used so it can be made better. It is off until you say Yes,
          for everyone, and you can change your answer at any time.
        </p>

        <h2 style={h2}>Your choice</h2>
        <p>
          Right now: <strong>{on ? 'On' : answer === 'no' ? 'Off' : 'Not asked yet (off)'}</strong>.
        </p>
        <button
          type="button"
          onClick={() => setConsent(on ? 'no' : 'yes')}
          style={{ minHeight: 44, padding: '0 18px', borderRadius: 8, border: '1px solid #6b7d74', background: on ? 'transparent' : '#9ed8b8', color: on ? '#f1efe6' : '#06150e', fontWeight: 600 }}
        >
          {on ? 'Turn usage data off' : 'Turn usage data on'}
        </button>
        <p style={{ opacity: 0.8, fontSize: 14 }}>
          You can also change this in Profile. Turning it off stops sending straight away. The answer is kept only on
          this device. To clear what Google already stored in your browser, clear this site&rsquo;s data in your browser settings.
        </p>

        <h2 style={h2}>Who collects it</h2>
        <p>
          Google Analytics, through Firebase, which Google runs. The Google script is only downloaded after you say Yes.
          It uses cookies or similar storage in your browser and sends usage to Google.
        </p>

        <h2 style={h2}>What is collected (only after Yes)</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Your rough device type, browser and country, which Google works out from the connection.</li>
          <li>
            Typed text in two cases only, lowercased and shortened to {TEXT_MAX} characters: a search that found nothing
            (<code>search_no_result</code>), and an ingredient name the app did not recognise (<code>ingredient_unrecognised</code>).
            Text that contains an @ or a web address is not sent.
          </li>
          <li>Only these events, each with the labels given and nothing else:</li>
        </ul>
        <ul data-testid="privacy-events" style={{ paddingLeft: 36, fontSize: 14 }}>
          {Object.entries(EVENTS).map(([name, def]) => (
            <li key={name} data-testid="privacy-event" data-event={name}><code>{name}</code>: {def.plain}</li>
          ))}
        </ul>

        <h2 style={h2}>What is never sent</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Your name, email or account id.</li>
          <li>The names or contents of recipes, drinks or sauces you wrote or saved, any nickname you chose for a shared recipe, or the id of a link you made.</li>
          <li>Your photos.</li>
        </ul>
        <p>No ads are shown and nothing is sold.</p>

        <h2 style={h2}>Feedback notes (separate from usage data)</h2>
        <p data-testid="privacy-feedback">
          &ldquo;Send feedback&rdquo; sends only what you type in its two boxes (a note of up to 500 characters and an
          optional &ldquo;what were you trying to do&rdquo; of up to 200), the screen you were on, and the time. It stores
          no name, email, account id or device details, and Google&rsquo;s usage counting is not involved. It works whatever you
          answered above, because you press Send yourself. Please do not put personal details in a note.
        </p>

        <h2 style={h2}>Your shopping list (separate from usage data)</h2>
        <p data-testid="privacy-shopping">
          The shopping list is kept in this browser. If you are signed in it is also saved with your account, so it follows
          you to your other devices; it is not public and not shared with anyone. The three shopping events listed above carry
          only counts and labels, never what is on your list.
        </p>

        <h2 style={h2}>Pictures on recipes you share (separate from usage data)</h2>
        <p data-testid="privacy-pictures">
          If you add a picture to a recipe, your photo is turned into a chalk drawing inside your browser and the original
          photo is never uploaded. Only the drawing is stored, with your saved recipe. If you then create a share link for that
          recipe, the drawing is public to anyone who has the link, together with the recipe, until you unshare it.
          Usage counting is not involved.
        </p>

        <h2 style={h2}>If you say No, or do not answer</h2>
        <p>Nothing is sent and no Google analytics script is loaded. The app works the same.</p>
      </div>
    </main>
  );
}
