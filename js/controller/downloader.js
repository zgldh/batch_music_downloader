/* eslint-disable import/no-unresolved */
/* eslint-disable global-require */
/* eslint-disable no-undef */
/* eslint-disable no-param-reassign */
/* global angular i18next sourceList platformSourceList */
angular.module('listenone').controller('DownloaderController', [
  '$scope',
  '$timeout',
  ($scope, $timeout) => {
    // Helper function to calculate string similarity
    const levenshteinDistance = (a, b) => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      
      const matrix = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          const cost = a[j-1] === b[i-1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i-1][j] + 1,
            matrix[i][j-1] + 1,
            matrix[i-1][j-1] + cost
          );
        }
      }
      return matrix[b.length][a.length];
    };
    $scope.inputText = '';
    $scope.songs = [];
    $scope.isLoading = false;
    $scope.error = '';
    $scope.activeDownloads = {};

    $scope.init = () => {
    };

    $scope.extractSongInfo = (text) => {
      return new Promise(resolve => {
        $timeout(() => {
          try {
            const pattern = /(.*?)点歌[:：]\s*(.+)/g;
            let matches = [...text.matchAll(pattern)];

            if (!matches.length) {
              resolve([]);
              return;
            }
            const extracted = matches.map(match => {
              // 去掉 requester 前后的空格、半角冒号、全角冒号
              let requester = match[1].replace(/^[\s:：]+|[\s:：]+$/g, '') || '匿名';
              return {
                requester,
                song: match[2].trim()
              };
            });

            resolve(extracted);
          } catch (err) {
            resolve([]);
          }
        }, 1500);
      });
    };

    $scope.processSongs = async (songInfos) => {
      const newSongs = songInfos.map(info => ({
        requester: info.requester,
        song: info.song,
        searchStatus: 'searching',
        downloadStatus: 'pending',
        progress: 0,
        /**
         * Example item structure in tracks:
         * {
         *   album: "No Protection",
         *   album_id: "nealbum_1995776",
         *   artist: "Starship",
         *   artist_id: "neartist_74939",
         *   id: "netrack_21680447",
         *   img_url: "https://p1.music.126.net/fNjCgSDoEegZWgKD2UGjaA==/109951166677563218.jpg",
         *   source: "netease",
         *   source_url: "https://music.163.com/#/song?id=21680447",
         *   title: "Nothing's Gonna Stop Us Now"
         * }
         */
        tracks: [],
      }));

      $timeout(() => {
        $scope.songs = newSongs;
      });

      for (let i = 0; i < newSongs.length; i++) {
        await new Promise(resolve => $timeout(resolve, 2000));
            MediaService.search("allmusic", {
          keywords: newSongs[i].song,
          curpage: 1,
          type: 0,
        }).success(function (response) {
          if (response && response.total > 0) {
            // Sort results by relevance to search query
            const searchStr = newSongs[i].song.toLowerCase();
            const sortedResults = response.result.sort((a, b) => {
              const aStr = `${a.title} ${a.artist}`.toLowerCase();
              const bStr = `${b.title} ${b.artist}`.toLowerCase();
              
              // Exact matches come first
              if (aStr.includes(searchStr)) return -1;
              if (bStr.includes(searchStr)) return 1;
              
              // Then closest matches
              const aDist = levenshteinDistance(searchStr, aStr);
              const bDist = levenshteinDistance(searchStr, bStr);
              return aDist - bDist;
            });

            $timeout(() => {
              $scope.songs[i].searchStatus = 'found';
              $scope.songs[i].downloadStatus = 'pending';
              $scope.songs[i].tracks = sortedResults;
              $scope.songs[i].selectedTrack = sortedResults[0].id;
            });
          } else {
            $timeout(() => {
              $scope.songs[i].searchStatus = 'not_found';
            });
          }
        })
      }
    };

    $scope.download = (index) => {
      return new Promise(resolve => {
        const selectedTrack = $scope.songs[index].tracks.find(t => t.id === $scope.songs[index].selectedTrack);
        if (!selectedTrack) {
          $timeout(() => {
            $scope.songs[index].error = '请选择要下载的歌曲版本';
            $scope.songs[index].downloadStatus = 'pending';
          });
          return resolve();
        }

        $timeout(() => {
          $scope.songs[index].error = '';
          $scope.songs[index].downloadStatus = 'downloading';
          $scope.songs[index].progress = 0;
        });

        MediaService.bootstrapTrack(
          selectedTrack,
          (bootinfo) => {
            $timeout(() => {
              const xhr = new XMLHttpRequest();
              $scope.activeDownloads[index] = xhr;
              xhr.open('GET', bootinfo.url, true);
              xhr.responseType = 'blob';

              xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                  const percent = Math.round((event.loaded / event.total) * 100);
                  $scope.songs[index].progress = percent;
                  $scope.$apply();
                }
              };

              xhr.onload = () => {
                if (xhr.status === 200) {
                  const blob = xhr.response;
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${index + 1}_${$scope.songs[index].requester}_${selectedTrack.title}_${selectedTrack.artist}.mp3`.replace(/[\\/:*?"<>|]/g, '_');
                  a.style.display = 'none';
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);

                  $scope.songs[index].downloadStatus = 'completed';
                  delete $scope.activeDownloads[index];
                  $scope.$apply();
                  resolve();
                } else {
                  $scope.songs[index].error = '下载失败';
                  $scope.songs[index].downloadStatus = 'pending';
                  delete $scope.activeDownloads[index];
                  $scope.$apply();
                  resolve();
                }
              };

              xhr.onerror = () => {
                $scope.songs[index].error = '下载失败';
                $scope.songs[index].downloadStatus = 'pending';
                delete $scope.activeDownloads[index];
                $scope.$apply();
                resolve();
              };

              xhr.send();
            });
          },
          () => {
            $timeout(() => {
              $scope.songs[index].error = '下载失败';
              $scope.songs[index].downloadStatus = 'pending';
              resolve();
            });
          }
        );
      });
    };

    $scope.handleExtract = async () => {
      $timeout(() => {
        if (!$scope.inputText.trim()) {
          $scope.error = '请输入符合格式的点歌请求';
          return;
        }

        $scope.error = '';
        $scope.isLoading = true;
      });

      try {
        const songInfos = await $scope.extractSongInfo($scope.inputText);
        $timeout(() => {
          $scope.isLoading = false;
          if (songInfos.length === 0) {
            $scope.error = '未检测到符合格式的点歌请求，请以"点歌："开头标注歌曲名称';
            return;
          }
          $scope.processSongs(songInfos);
        });
      } catch (err) {
        $timeout(() => {
          $scope.error = '点歌信息提取失败';
          $scope.isLoading = false;
        });
      }
    };

    $scope.stopDownload = (index) => {
      if ($scope.activeDownloads[index]) {
        $scope.activeDownloads[index].abort();
        delete $scope.activeDownloads[index];
        $timeout(() => {
          $scope.songs[index].downloadStatus = 'pending';
          $scope.songs[index].error = '下载已取消';
          $scope.$apply();
        });
      }
    };

    $scope.nextTrack = (index) => {
      if (!$scope.songs[index] || !$scope.songs[index].tracks || $scope.songs[index].tracks.length <= 1) {
        return;
      }

      const currentIndex = $scope.songs[index].tracks.findIndex(
        t => t.id === $scope.songs[index].selectedTrack
      );
      const nextIndex = (currentIndex + 1) % $scope.songs[index].tracks.length;
      
      $timeout(() => {
        $scope.songs[index].selectedTrack = $scope.songs[index].tracks[nextIndex].id;
        $scope.$apply();
      });
    };

    $scope.getStatusColor = (status) => {
      switch (status) {
        case 'searching':
        case 'downloading':
          return '#3b82f6'; // blue-500
        case 'found':
        case 'completed':
          return '#10b981'; // green-500
        case 'not_found':
          return '#ef4444'; // red-500
        case 'pending':
        default:
          return '#6b7280'; // gray-500
      }
    };
  },
]);
