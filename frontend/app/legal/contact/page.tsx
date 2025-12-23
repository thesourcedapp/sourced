export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2" style={{ fontFamily: 'Arial Black, sans-serif' }}>
          CONTACT US
        </h1>
        <p className="text-sm text-black/60 mb-8">
          Get in touch with the Sourced team
        </p>

        <div className="space-y-8 text-black/80 leading-relaxed">
          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              General Inquiries
            </h2>
            <p>
              For general questions, feedback, or support:<br />
              📧 <a href="mailto:thesourcedapp@gmail.com" className="text-black underline hover:no-underline">thesourcedapp@gmail.com</a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Legal & Copyright
            </h2>
            <p>
              For DMCA takedown requests or legal matters:<br />
              📧 <a href="mailto:thesourcedapp@gmail.com" className="text-black underline hover:no-underline">thesourcedapp@gmail.com</a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Data Requests
            </h2>
            <p>
              To request access, deletion, or correction of your personal data:<br />
              📧 <a href="mailto:thesourcedapp@gmail.com" className="text-black underline hover:no-underline">thesourcedapp@gmail.com</a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              Response Time
            </h2>
            <p>
              We aim to respond to all inquiries within 2-3 business days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}