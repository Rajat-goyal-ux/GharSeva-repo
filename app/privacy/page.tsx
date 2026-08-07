import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GharSeva",
  description: "GharSeva ki privacy, location aur advertising policy.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <Link href="/" className="brand"><span className="roof">⌂</span><span>Ghar<em>Seva</em></span></Link>
        <Link href="/">← App पर वापस जाएँ</Link>
      </header>
      <article className="privacy-content">
        <p className="eyebrow">PRIVACY & DATA</p>
        <h1>Privacy Policy</h1>
        <p className="privacy-updated">Last updated: 7 August 2026</p>

        <section>
          <h2>हम कौन-सी जानकारी लेते हैं</h2>
          <p>Google sign-in के समय Firebase से Google account ID, verified email और display name मिलता है. Vendor registration में नाम, contact mobile, काम की category, area, pincode, experience और rate लिया जाता है. Live matching के लिए vendor की availability और app में recent activity time रखा जाता है. Service request में owner का नाम, contact mobile, address, काम का detail, समय और optional budget लिया जाता है.</p>
        </section>
        <section>
          <h2>Location कैसे इस्तेमाल होती है</h2>
          <p>Location केवल आपकी permission के बाद ली जाती है. इसका उपयोग area-wise vendor matching, owner को latest vendor location दिखाने और service coordination के लिए किया जाता है. आप browser या phone settings से location permission बंद कर सकते हैं.</p>
        </section>
        <section>
          <h2>जानकारी किसे दिखाई जा सकती है</h2>
          <p>Public vendor list में vendor का mobile number, Google account ID, email, precise location या exact recent activity time नहीं दिखाई जाती; केवल Online/Offline status दिख सकता है. काम connect करने के लिए contact, address और request details केवल signed-in request owner या assigned vendor को दिखाई जा सकती हैं. Open lead का पूरा address और owner contact vendor को काम accept करने के बाद मिलता है. हम users को final rate, काम का scope और पहचान सीधे confirm करने की सलाह देते हैं.</p>
        </section>
        <section>
          <h2>Google sign-in</h2>
          <p>Customer और vendor account security के लिए Google Sign-In और Firebase Authentication इस्तेमाल होते हैं. GharSeva को आपका Google password नहीं मिलता. Form में दिया contact mobile SMS से verify नहीं होता; Google sign-in भी vendor की skill, police या background verification नहीं है.</p>
        </section>
        <section>
          <h2>Advertising और cookies</h2>
          <p>AdSense approval के बाद Google सहित third-party vendors ads दिखाने और उनकी performance मापने के लिए cookies या similar technologies इस्तेमाल कर सकते हैं. Google advertising cookies आपके इस site या दूसरे sites के visits के आधार पर ads चुन सकती हैं. Personalized ads को आप <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">Google Ads Settings</a> में manage या बंद कर सकते हैं.</p>
        </section>
        <section>
          <h2>Security और retention</h2>
          <p>Sensitive app actions में Google/Firebase ID token server पर signature, issuer, audience और sign-in provider के साथ verify किया जाता है. Vendor profile और service request Google account ID से bind रहती है. जानकारी को service चलाने, fraud रोकने और कानूनी जरूरत पूरी करने जितने समय तक रखा जा सकता है. जरूरी retention अवधि पूरी होने के बाद data delete या anonymize किया जा सकता है.</p>
        </section>
        <aside className="privacy-note">
          <b>Operator, support और data deletion</b>
          <p><strong>GharSeva — operated by Rajat Goyal</strong><br/>Email: <a href="mailto:rajatgoyal8770@gmail.com">rajatgoyal8770@gmail.com</a></p>
          <p>Data correction या deletion के लिए signed-in Google email और, उपलब्ध हो तो, request ID के साथ email करें. पहचान verify करने और कानूनी retention पूरा करने के बाद request process की जाएगी.</p>
        </aside>
      </article>
    </main>
  );
}
