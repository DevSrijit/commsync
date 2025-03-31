declare module "react-highlight-words" {
  interface HighlighterProps {
    searchWords: string[];
    textToHighlight: string;
    highlightClassName?: string;
    highlightStyle?: React.CSSProperties;
    autoEscape?: boolean;
    caseSensitive?: boolean;
    sanitize?: (text: string) => string;
    findChunks?: (options: {
      textToHighlight: string;
      searchWords: string[];
      caseSensitive?: boolean;
      sanitize?: (text: string) => string;
    }) => Array<{
      start: number;
      end: number;
      highlight: boolean;
    }>;
  }

  const Highlighter: React.FC<HighlighterProps>;
  export default Highlighter;
}
