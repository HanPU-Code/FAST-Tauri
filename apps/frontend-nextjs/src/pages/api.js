import { useState } from 'react';
import api from '../utils/api';
import Link from 'next/link';

export default function ApiPage() {
  const [endpoint, setEndpoint] = useState('/api/status');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleApiCall = async () => {
    try {
      setIsLoading(true);
      setResult('요청 처리 중...');
      const response = await api.get(endpoint);
      setResult(JSON.stringify(response.data, null, 2));
    } catch (error) {
      setResult(`에러 발생: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>API 테스트 페이지</h1>
      
      <Link href="/" className="link">
        홈으로 돌아가기
      </Link>
      
      <div className="card">
        <h2>API 요청 테스트</h2>
        <div className="form-group">
          <label>엔드포인트:</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="API 엔드포인트 입력 (예: /api/status)"
          />
        </div>
        
        <button 
          onClick={handleApiCall}
          disabled={isLoading}
          className="button"
        >
          {isLoading ? '로딩중...' : 'API 호출'}
        </button>
        
        <div className="result">
          <h3>응답 결과:</h3>
          <pre>{result}</pre>
        </div>
      </div>
      
      <style jsx>{`
        .link {
          display: inline-block;
          margin-bottom: 20px;
          color: #0070f3;
          text-decoration: none;
        }
        
        .card {
          padding: 20px;
          border: 1px solid #eaeaea;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
        }
        
        input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .button {
          background-color: #0070f3;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .button:hover {
          background-color: #0056b3;
        }
        
        .button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .result {
          margin-top: 20px;
        }
        
        pre {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
} 