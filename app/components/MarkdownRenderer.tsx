import React, { memo, useState } from 'react';
import { Clipboard } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import materialOceanic from 'react-syntax-highlighter/dist/cjs/styles/prism/material-oceanic';
import tsx from 'react-syntax-highlighter/dist/cjs/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript';
import markdown from 'react-syntax-highlighter/dist/cjs/languages/prism/markdown';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import css from 'react-syntax-highlighter/dist/cjs/languages/prism/css';

SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
import 'katex/dist/katex.min.css'; // KaTeX CSS

interface MarkdownRendererProps {
  content: string;
}

const CodeBlock: React.FC<{
  node?: object;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({ node: _node, inline, className, children, ...props }) => {
  const [hasMounted, setHasMounted] = React.useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const match = /language-(\w+)/.exec(className || '');
  return !inline && match ? (
    <div className="relative rounded-md overflow-hidden my-4 shadow-md">
      <div className="flex justify-between items-center bg-gray-800 px-4 py-2 text-gray-400 text-xs font-mono rounded-t-md">
        <span>{match[1].toUpperCase()}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors duration-200"
        >
          <Clipboard size={14} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="overflow-auto custom-scrollbar">
        <SyntaxHighlighter
          style={materialOceanic}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            paddingTop: 0,
            borderBottomLeftRadius: '0.375rem',
            borderBottomRightRadius: '0.375rem',
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    </div>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) {
    return null; // Return null for empty content
  }

  return (
    <div className="markdown-body">
      <Markdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code: CodeBlock,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};


export default memo(MarkdownRenderer);
