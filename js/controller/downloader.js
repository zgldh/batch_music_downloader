/* eslint-disable import/no-unresolved */
/* eslint-disable global-require */
/* eslint-disable no-undef */
/* eslint-disable no-param-reassign */
/* global angular i18next sourceList platformSourceList */
angular.module('listenone').controller('DownloaderController', [
  '$scope',
  '$timeout',
  ($scope, $timeout) => {
    $scope.inputText = '';
    $scope.songs = [];
    $scope.isLoading = false;
    $scope.error = '';

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
        MediaService.search("allmusic", {
          keywords: newSongs[i].song,
          curpage: 1,
          type: 0,
        }).success(function (response) {
          if (response && response.total > 0) {
            $timeout(() => {
              $scope.songs[i].searchStatus = 'found';
              $scope.songs[i].downloadStatus = 'pending';
              $scope.songs[i].tracks = response.result;
              $scope.songs[i].selectedTrack = response.result[0].id;
            });
          } else {
            $timeout(() => {
              $scope.songs[i].searchStatus = 'not_found';
            });
          }
        })

        // await new Promise(resolve => $timeout(resolve, 800));

        // $timeout(() => {
        //   $scope.songs[i].searchStatus = Math.random() > 0.2 ? 'found' : 'not_found';

        //   if ($scope.songs[i].searchStatus === 'found') {
        //     $scope.simulateDownload(i);
        //   }
        // });
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
          $scope.songs[index].downloadStatus = 'downloading';
          $scope.songs[index].progress = 0;
        });

        MediaService.bootstrapTrack(
          selectedTrack,
          (bootinfo) => {
            $timeout(() => {
              const xhr = new XMLHttpRequest();
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
                  $scope.$apply();
                  resolve();
                } else {
                  $scope.songs[index].error = '下载失败';
                  $scope.songs[index].downloadStatus = 'pending';
                  $scope.$apply();
                  resolve();
                }
              };

              xhr.onerror = () => {
                $scope.songs[index].error = '下载失败';
                $scope.songs[index].downloadStatus = 'pending';
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
