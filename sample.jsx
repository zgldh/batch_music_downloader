import { useState } from 'react';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 提取点歌人和歌曲名称
  const extractSongInfo = (text) => {
    return new Promise(resolve => {
      setTimeout(() => {
        try {
          // 匹配格式：[点歌人]点歌：歌曲名称
          const pattern = /(.*?)点歌[:：]\s*(.+)/g;
          let matches = [...text.matchAll(pattern)];
          
          if (!matches.length) {
            resolve([]);
            return;
          }

          // 提取点歌人和歌曲名称
          const extracted = matches.map(match => ({
            requester: match[1].trim() || '匿名',
            song: match[2].trim()
          }));

          resolve(extracted);
        } catch (err) {
          resolve([]);
        }
      }, 1500);
    });
  };

  // 模拟处理歌曲列表
  const processSongs = async (songInfos) => {
    const newSongs = songInfos.map(info => ({
      requester: info.requester,
      song: info.song,
      searchStatus: 'searching',
      downloadStatus: 'pending',
      progress: 0
    }));
    
    setSongs(newSongs);
    
    // 模拟逐个搜索
    for (let i = 0; i < newSongs.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setSongs(prev => {
        const updated = [...prev];
        updated[i].searchStatus = Math.random() > 0.2 ? 'found' : 'not_found';
        return updated;
      });
    }
    
    // 模拟下载过程
    for (let i = 0; i < newSongs.length; i++) {
      if (newSongs[i].searchStatus === 'found') {
        await simulateDownload(i);
      }
    }
  };

  // 模拟下载过程
  const simulateDownload = (index) => {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        setSongs(prev => {
          const updated = [...prev];
          if (updated[index].progress < 100) {
            updated[index].progress += Math.random() * 20;
            if (updated[index].progress > 100) updated[index].progress = 100;
          }
          
          if (updated[index].progress >= 100) {
            clearInterval(interval);
            updated[index].downloadStatus = 'completed';
            resolve();
          }
          
          return updated;
        });
      }, 500);
    });
  };

  const handleExtract = async () => {
    if (!inputText.trim()) {
      setError('请输入符合格式的点歌请求');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      const songInfos = await extractSongInfo(inputText);
      if (songInfos.length === 0) {
        setError('未检测到符合格式的点歌请求，请以"点歌："开头标注歌曲名称');
        setIsLoading(false);
        return;
      }
      await processSongs(songInfos);
    } catch (err) {
      setError('点歌信息提取失败');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'searching': return 'bg-blue-500';
      case 'found': return 'bg-green-500';
      case 'not_found': return 'bg-red-500';
      case 'completed': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">智能点歌系统</h1>
          <p className="text-gray-600">支持识别点歌人信息，格式：[点歌人]点歌：歌曲名称</p>
        </header>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`请使用标准格式输入：
张三点歌：光年之外
李四 点歌：起风了
点歌：晴天
王五点歌：她说`}
            rows={8}
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
          <button
            onClick={handleExtract}
            disabled={isLoading}
            className={`mt-4 w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center ${
              isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
            } transition`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                处理中...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 21L15 15M17 10C17 13.866 13.8658 17 10 17C6.13418 17 3 13.8658 3 10C3 6.13418 6.13418 3 10 3C13.8658 3 17 6.13418 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                提取并下载
              </>
            )}
          </button>
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        </div>

        {songs.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">识别结果</h2>
            
            <div className="space-y-4">
              {songs.map((song, index) => (
                <div 
                  key={index} 
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800">{song.song}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        点歌人：<span className="font-medium">{song.requester}</span>
                      </p>
                    </div>
                    <div className="flex flex-col space-y-2 items-end">
                      <div className="flex items-center">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(song.searchStatus)} mr-1`}></span>
                        <span className="text-sm text-gray-600">
                          {song.searchStatus === 'searching' ? '搜索中...' : 
                           song.searchStatus === 'found' ? '已找到' : '未找到'}
                        </span>
                      </div>
                      {song.searchStatus === 'found' && (
                        <div className="flex items-center">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(song.downloadStatus)} mr-1`}></span>
                          <span className="text-sm text-gray-600">
                            {song.downloadStatus === 'pending' ? '等待下载' : 
                             song.downloadStatus === 'completed' ? '下载完成' : '下载中'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {song.searchStatus === 'found' && song.downloadStatus !== 'completed' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>下载进度</span>
                        <span>{song.progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
                          style={{ width: `${song.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {song.searchStatus === 'not_found' && (
                    <div className="mt-2 text-sm text-red-500">
                      未找到匹配的歌曲
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
