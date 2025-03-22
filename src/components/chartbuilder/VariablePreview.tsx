import { useState } from 'react';
import { Alert, Button } from '@navikt/ds-react';
import { Check, Copy } from 'lucide-react';

interface VariablePreviewProps {
  sql: string;
}

const VariablePreview = ({ sql }: VariablePreviewProps) => {
  const [copied, setCopied] = useState(false);

  // Highlight variables in the SQL
  const highlightVariables = (code: string) => {
    if (!code) return '';
    
    // Replace variables with highlighted span
    return code.replace(/\{\{([^}]+)\}\}/g, 
      '<span class="bg-blue-100 text-blue-800 px-1 rounded font-bold">{{$1}}</span>'
    ).replace(/\[\[(.*?)\]\]/g, 
      '<span class="bg-purple-50 text-purple-800 px-1 rounded border border-purple-200">[[$1]]</span>'
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="mt-4 bg-white p-4 rounded-lg border shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">Forhåndsvisning av variabel</h3>
        {!copied ? (
          <Button 
            variant="secondary" 
            size="small" 
            onClick={handleCopy} 
            icon={<Copy size={16} />}
          >
            Kopier SQL
          </Button>
        ) : (
          <div className="flex items-center text-sm text-green-600">
            <Check size={16} className="mr-1" /> Kopiert!
          </div>
        )}
      </div>
      
      <pre className="bg-gray-50 p-3 rounded overflow-x-auto text-sm border max-h-[200px] overflow-y-auto">
        <code dangerouslySetInnerHTML={{ __html: highlightVariables(sql) }} />
      </pre>
      
      {sql.includes('{{') && (
        <Alert variant="info" className="mt-2" size="small">
          Variabler er markert i blått og vil bli interaktive filtre i Metabase
        </Alert>
      )}
    </div>
  );
};

export default VariablePreview;
