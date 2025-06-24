import React, { Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeReact from 'rehype-react';
import 'katex/dist/katex.min.css'; // KaTeX CSS

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) {
    return null; // Return null for empty content
  }

  const processor = unified()
    .use(remarkParse) // Parse markdown
    .use(remarkMath) // Support math syntax like $...$ and $$...$$
    .use(remarkRehype) // Turn markdown into HTML
    .use(rehypeKatex) // Render math with KaTeX
    .use(rehypeReact, {
      createElement: React.createElement,
      Fragment: Fragment,
      jsx: jsx,
      jsxs: jsxs
    }); // Turn HTML into React components

  let renderedContent;
  try {
    renderedContent = processor.processSync(content).result;
  } catch (error) {
    console.error('Error processing markdown with LaTeX:', error);
    // Return a simpler error message or null if the error is due to malformed input
    return <div style={{ color: 'red' }}>Rendering error. See console for details.</div>;
  }

  return <div className="markdown-body">{renderedContent}</div>;
};

export default MarkdownRenderer;
