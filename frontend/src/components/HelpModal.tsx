import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from '../context/ThemeContext';
import { useChatStore } from '@/stores';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { isDarkMode } = useTheme();
  const helpText = useChatStore((s) => s.helpText);
  const isHelpTextLoading = useChatStore((s) => s.isHelpTextLoading);
  const fetchHelpText = useChatStore((s) => s.fetchHelpText);

  useEffect(() => {
    if (isOpen && !helpText && !isHelpTextLoading) {
      fetchHelpText();
    }
  }, [isOpen, helpText, isHelpTextLoading, fetchHelpText]);

  useEffect(() => {
    if (!isOpen) return;

    const existingScript = document.querySelector('script[src="https://server.fillout.com/embed/v1/"]');

    if (existingScript) return;

    const script = document.createElement('script');
    script.src = 'https://server.fillout.com/embed/v1/';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [isOpen]);

  // Custom markdown components
  const MarkdownComponents = {
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : ''

      return !inline ? (
        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <SyntaxHighlighter
            style={isDarkMode ? oneDark : oneLight}
            language={language}
            PreTag="div"
            className="rounded-lg !mt-2 !mb-2 text-xs sm:text-sm"
            wrapLongLines={true}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className={`px-1.5 py-0.5 rounded-md text-xs sm:text-sm font-mono break-all ${
            isDarkMode
              ? 'bg-dark-surface text-dark-text border border-dark-border'
              : 'bg-light-surface text-light-text border border-light-border'
          }`}
          {...props}
        >
          {children}
        </code>
      )
    },
    pre: ({ children }: any) => (
      <pre className="overflow-x-auto max-w-full">{children}</pre>
    ),
    p: ({ children }: any) => (
      <p className="mb-2 last:mb-0 break-words overflow-wrap-anywhere">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className={`list-disc pl-5 sm:pl-6 mb-3 mt-2 space-y-1.5 ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className={`list-decimal pl-5 sm:pl-6 mb-3 mt-2 space-y-1.5 ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="ml-0 break-words overflow-wrap-anywhere leading-relaxed pl-1">{children}</li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className={`border-l-4 pl-3 sm:pl-4 py-2 my-2 italic break-words ${
        isDarkMode
          ? 'border-dark-border bg-dark-surface text-dark-textSecondary'
          : 'border-light-border bg-light-surface text-light-textSecondary'
      }`}>
        {children}
      </blockquote>
    ),
    h1: ({ children }: any) => (
      <h1 className={`text-lg sm:text-xl font-bold mb-3 mt-4 break-words ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className={`text-base sm:text-lg font-bold mb-2 mt-3 break-words ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className={`text-sm sm:text-base font-bold mb-2 mt-2 break-words ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </h3>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto -mx-2 sm:mx-0 my-4">
        <table className="min-w-full">{children}</table>
      </div>
    ),
    img: ({ src, alt, ...props }: any) => (
      <img
        src={src}
        alt={alt}
        className="max-w-full h-auto rounded-lg my-2"
        {...props}
      />
    ),
    a: ({ href, children, ...props }: any) => (
      <a
        href={href}
        className={`break-all underline ${
          isDarkMode ? 'text-hthgse-400 hover:text-hthgse-300' : 'text-hthgse-600 hover:text-hthgse-700'
        }`}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${
            isDarkMode
              ? 'bg-gray-800 border border-gray-700'
              : 'bg-white border border-gray-200'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`sticky top-0 flex items-center justify-between p-6 border-b ${
            isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
          }`}>
            <h2 className={`text-2xl font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Help
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-0.4 h-[500px] p-6" data-fillout-id="niJq2cMpyous" data-fillout-embed-type="standard" data-fillout-inherit-parameters data-fillout-dynamic-resize data-fillout-domain="forms.hthgse.edu">
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {!isHelpTextLoading && (
              <div className={`prose prose-sm ${isDarkMode ? 'prose-invert' : ''} max-w-none overflow-hidden`}
                style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
                <Markdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={MarkdownComponents}
                >
                  {helpText || ''}
                </Markdown>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`sticky bottom-0 p-6 border-t ${
            isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
          }`}>
            <Button
              onClick={onClose}
              className="w-full"
            >
              Got it, let's get started!
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default HelpModal;
