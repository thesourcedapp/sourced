export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2" style={{ fontFamily: 'Arial Black, sans-serif' }}>
          PRIVACY POLICY
        </h1>
        <p className="text-sm text-black/60 mb-8">
          Last updated: December 22, 2025
        </p>

        <div className="space-y-8 text-black/80 leading-relaxed">
          <div>
            <p>
              Sourced ("we," "us," or "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect your information.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              1. Information We Collect
            </h2>
            <p className="mb-2">We may collect:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Uploaded images</li>
              <li>Account information (email, username)</li>
              <li>Usage data (interactions, searches)</li>
              <li>Device and browser information</li>
              <li>Cookies and analytics data</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              2. How We Use Your Information
            </h2>
            <p className="mb-2">We use your information to:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Provide visual search functionality</li>
              <li>Improve product discovery</li>
              <li>Operate and maintain the Service</li>
              <li>Communicate with users</li>
              <li>Ensure security and prevent abuse</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              3. Image Processing & AI
            </h2>
            <p className="mb-3">
              Uploaded images are processed using automated systems, including AI models, to identify and match products.
            </p>
            <p className="mb-2">Images may be:</p>
            <ul className="list-disc ml-6 mb-3 space-y-1">
              <li>Temporarily stored</li>
              <li>Analyzed for visual features</li>
              <li>Deleted or anonymized after processing</li>
            </ul>
            <p>
              We do not use user images to train proprietary models.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              4. Third-Party Services
            </h2>
            <p className="mb-2">We may share limited data with trusted third-party providers, including:</p>
            <ul className="list-disc ml-6 mb-3 space-y-1">
              <li>Cloud storage providers</li>
              <li>Analytics services</li>
              <li>AI processing services</li>
              <li>Search and product data providers</li>
            </ul>
            <p>
              These services are used strictly to operate the platform.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              5. Cookies
            </h2>
            <p>
              We may use cookies and similar technologies to improve functionality and analyze usage.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              6. Data Retention
            </h2>
            <p>
              We retain data only as long as necessary to provide the Service or comply with legal obligations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              7. Your Rights
            </h2>
            <p className="mb-2">Depending on your location, you may have the right to:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Access your data</li>
              <li>Request deletion</li>
              <li>Request correction</li>
              <li>Opt out of certain processing</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              8. Data Security
            </h2>
            <p>
              We implement reasonable technical and organizational safeguards to protect your data.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              10. Contact
            </h2>
            <p>
              For privacy questions or requests:<br />
              📧 <a href="mailto:thesourcedapp@gmail.com" className="text-black underline hover:no-underline">thesourcedapp@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}