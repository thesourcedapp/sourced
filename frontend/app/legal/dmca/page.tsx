export default function DMCAPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2" style={{ fontFamily: 'Arial Black, sans-serif' }}>
          COPYRIGHT & DMCA POLICY
        </h1>
        <p className="text-sm text-black/60 mb-8">
          Last updated: December 22, 2025
        </p>

        <div className="space-y-8 text-black/80 leading-relaxed">
          <div>
            <p>
              Sourced respects the intellectual property rights of others and expects users to do the same.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Use of Images
            </h2>
            <p className="mb-2">Images displayed on Sourced are used for:</p>
            <ul className="list-disc ml-6 mb-3 space-y-1">
              <li>Product identification</li>
              <li>Visual search</li>
              <li>Discovery and reference</li>
            </ul>
            <p>
              Images may originate from third-party retailers or user uploads.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              DMCA Takedown Requests
            </h2>
            <p className="mb-3">
              If you believe content on Sourced infringes your copyright, please submit a takedown notice including:
            </p>
            <ol className="list-decimal ml-6 space-y-2">
              <li>Your name and contact information</li>
              <li>A description of the copyrighted work</li>
              <li>The URL(s) of the allegedly infringing content</li>
              <li>A statement that you believe in good faith the use is unauthorized</li>
              <li>A statement under penalty of perjury that the information is accurate</li>
              <li>Your electronic or physical signature</li>
            </ol>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Contact
            </h2>
            <p>
              Send requests to:<br />
              📧 <a href="mailto:thesourcedapp@gmail.com" className="text-black underline hover:no-underline">thesourcedapp@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}