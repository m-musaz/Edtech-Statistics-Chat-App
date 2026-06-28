import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import HelpModal from '../components/HelpModal';
import { useTheme } from '../context/ThemeContext';
import { useChatStore } from '@/stores';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const AboutPage: React.FC = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const aboutText = useChatStore((s) => s.aboutText);
  const isAboutTextLoading = useChatStore((s) => s.isAboutTextLoading);
  const fetchAboutText = useChatStore((s) => s.fetchAboutText);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const isHelpTextLoading = useChatStore((s) => s.isHelpTextLoading);

  useEffect(() => {
    if (!aboutText && !isAboutTextLoading) {
      fetchAboutText();
    }
  }, [aboutText, isAboutTextLoading, fetchAboutText]);

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

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`}
    >
      {/* Header - Same as ChatPage */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          isDarkMode
            ? 'border-gray-700 bg-gray-800'
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center space-x-3">
          {/* NCIE Logo and Text */}
          <a 
            href="https://www.hthgse.edu/ncie/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <img 
              src="/NCIE-Logo_FullColor.png" 
              alt="NCIE Logo" 
              className="h-8 w-auto"
            />
            <span
              className={`text-sm font-medium hidden sm:inline ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              NCIE Control Chart Generator
            </span>
          </a>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="p-2"
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/chat')}
            className="px-3 py-2"
            title="About"
          >
            Chat
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="p-2"
            onClick={() => setHelpModalOpen(true)}
            title="Help"
          >
            {isHelpTextLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HelpCircle className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isAboutTextLoading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className={`text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Loading...
            </div>
          </div>
        ) : (
          <div className={`prose prose-sm ${isDarkMode ? 'prose-invert' : ''} max-w-none overflow-hidden`}
            style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
            <Markdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={MarkdownComponents}
            >
              {aboutText || 'No about information available.'}
            </Markdown>
          </div>
        )}
      </div>

      {/* Help Modal */}
      <HelpModal 
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />
    </div>
  );
};

export default AboutPage;

