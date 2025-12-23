export default function DataRequestsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2" style={{ fontFamily: 'Arial Black, sans-serif' }}>
          DATA REQUESTS
        </h1>
        <p className="text-sm text-black/60 mb-8">
          Last updated: December 22, 2025
        </p>

        <div className="space-y-8 text-black/80 leading-relaxed">
          <div>
            <p>
              Sourced respects your data rights.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              You May Request To:
            </h2>
            <ul className="list-disc ml-6 space-y-2">
              <li>Access your personal data</li>
              <li>Delete your personal data</li>
              <li>Correct inaccurate information</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              How to Make a Request
            </h2>
            <p className="mb-4">
              Please email us at:<br />
              📧 <a href="mailto:thesourcedapp@gmail.com" className="text-black underline hover:no-underline">thesourcedapp@gmail.com</a>
            </p>
            <p className="mb-2">Include:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>The email associated with your account</li>
              <li>The type of request (access, deletion, correction)</li>
            </ul>
          </div>

          <div>
            <p>
              We will respond within a reasonable timeframe, as required by applicable law.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}