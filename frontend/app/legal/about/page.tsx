export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2" style={{ fontFamily: 'Arial Black, sans-serif' }}>
          ABOUT SOURCED
        </h1>
        <p className="text-sm text-black/60 mb-8">
          Product discovery, reimagined
        </p>

        <div className="space-y-8 text-black/80 leading-relaxed">
          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              What is Sourced?
            </h2>
            <p>
              Sourced is a visual product discovery platform that helps you find items you love. Upload an image, and we'll help you discover visually similar products from retailers across the web.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Our Mission
            </h2>
            <p>
              We believe shopping should be intuitive and visual. Whether you spotted something in a photo, on the street, or in your imagination, Sourced makes it easy to find what you're looking for.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              How It Works
            </h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li><strong>Upload an image</strong> of a product you're interested in</li>
              <li><strong>Our AI analyzes</strong> the visual features</li>
              <li><strong>Discover similar products</strong> from trusted retailers</li>
              <li><strong>Compare and shop</strong> directly from the source</li>
            </ol>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Key Features
            </h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Visual search powered by AI</li>
              <li>Create and organize catalogs</li>
              <li>Save and bookmark favorites</li>
              <li>Discover new products effortlessly</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Privacy First
            </h2>
            <p>
              We respect your privacy. Images are processed solely to provide search results and are not used to train proprietary models. For more details, see our <a href="/legal/privacy" className="underline hover:no-underline">Privacy Policy</a>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Get in Touch
            </h2>
            <p>
              Have questions or feedback? We'd love to hear from you.<br />
              📧 <a href="mailto:thesourcedapp@gmail.com" className="text-black underline hover:no-underline">thesourcedapp@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}