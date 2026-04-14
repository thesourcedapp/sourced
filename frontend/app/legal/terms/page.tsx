export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2" style={{ fontFamily: 'Arial Black, sans-serif' }}>
          TERMS OF SERVICE
        </h1>
        <p className="text-sm text-black/60 mb-8">
          Last updated: April 13, 2026
        </p>

        <div className="space-y-8 text-black/80 leading-relaxed">
          <div>
            <p className="mb-4">
              <strong>Website:</strong> thesourcedapp.com<br />
              <strong>Company:</strong> Sourced<br />
              <strong>Contact:</strong> thesourcedapp@gmail.com
            </p>
          </div>

          <div>
            <p className="mb-4">
              Welcome to Sourced ("we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of thesourcedapp.com and any related services (collectively, the "Service").
            </p>
            <p>
              By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              1. Eligibility
            </h2>
            <p>
              You must be at least 13 years old to use the Service. By using Sourced, you represent that you meet this requirement.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              2. Description of the Service
            </h2>
            <p>
              Sourced is a product discovery platform that allows users to upload images and discover visually similar products from third-party retailers. Sourced does not sell products directly.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              3. Affiliate Disclosure
            </h2>
            <p className="mb-3">
              Some links on Sourced are affiliate links. This means that if you click a link and make a purchase, Sourced may earn a commission from the retailer at no additional cost to you.
            </p>
            <p className="mb-3">
              Sourced participates in affiliate programs including but not limited to Rakuten, Commission Junction (CJ), and Impact. Items that contain affiliate links are marked with a <strong>$</strong> indicator on the platform.
            </p>
            <p>
              Affiliate relationships do not influence which products creators choose to feature. Creators curate their own catalogs independently. This disclosure is made in compliance with the U.S. Federal Trade Commission (FTC) guidelines on endorsements and testimonials.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              4. User Content
            </h2>
            <p className="mb-3">
              You retain ownership of any images or content you upload ("User Content").
            </p>
            <p className="mb-3">
              By uploading content, you grant Sourced a limited, non-exclusive, royalty-free license to process and analyze that content solely for the purpose of providing the Service.
            </p>
            <p>You represent that:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>You own the content or have permission to upload it</li>
              <li>Your content does not violate any laws or third-party rights</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              5. Prohibited Uses
            </h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Upload illegal, harmful, or infringing content</li>
              <li>Attempt to reverse engineer the Service</li>
              <li>Abuse or overload the Service</li>
              <li>Use the Service for unlawful or commercial scraping purposes</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              6. Third-Party Links
            </h2>
            <p className="mb-3">
              The Service may link to third-party websites or retailers. Sourced is not responsible for third-party content, pricing, availability, or transactions.
            </p>
            <p>
              Purchases made through third-party links are solely between you and the retailer.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              7. No Guarantees
            </h2>
            <p className="mb-2">The Service is provided "as is" and "as available." We do not guarantee:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Accuracy of product matches</li>
              <li>Availability of products</li>
              <li>Continuous or error-free operation</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              8. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, Sourced shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              9. Termination
            </h2>
            <p>
              We may suspend or terminate access to the Service at any time, with or without notice, for any reason.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              10. Changes to These Terms
            </h2>
            <p>
              We may update these Terms at any time. Continued use of the Service constitutes acceptance of the updated Terms.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              11. Contact
            </h2>
            <p>
              Questions about these Terms?<br />
              📧 <a href="mailto:thesourcedapp@gmail.com" className="text-black underline hover:no-underline">thesourcedapp@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}