// --- 設定區 ---
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdBXyhDTU7AWpy06z227Xcw6zyImk0L8Dy_wTsnhU_wylVrhw/formResponse";

// 欄位對應 ID
const FIELD_IDS = {
    USER: "entry.1132990291",    // 使用者名稱
    TYPE: "entry.1441242373",    // 行為模式
    DURATION: "entry.820656012", // 觀看時間
    URL: "entry.1471590407"      // 影片網址
};

const MY_NAME = "vito";
// ------------------------------------------

// --- 變數初始化 ---
let lastUrl = location.href;
let currentType = null;      // 當前行為模式
let currentVideoUrl = null;  // 當前影片網址
let watchedSeconds = 0;      // 累計播放秒數
let trackingInterval = null; // 計時器核心

// 1. 監聽網頁網址變化
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        // 如果之前有在看影片，先結算上一支
        if (currentVideoUrl && watchedSeconds > 0) {
            saveData();
        }

        lastUrl = url;
        // 重置並開始新影片的追蹤
        resetTracking();
        checkAndStart(url);
    }
}).observe(document, { subtree: true, childList: true });

// 2. 另外監聽：關閉視窗前也要存檔
window.addEventListener("beforeunload", () => {
    if (currentVideoUrl && watchedSeconds > 0) {
        saveData();
    }
});

// --- 核心功能 ---

// 判斷是否進入影片頁面
function checkAndStart(url) {
    if (url.includes("/watch?v=") || url.includes("/shorts/")) {

        currentVideoUrl = url;

        // 判斷來源 (Type A/B/C)
        let previousPage = sessionStorage.getItem("prevPath") || "direct";
        if (previousPage.includes("results?search_query")) {
            currentType = "Type A/B (Active Search)";
        } else if (previousPage.includes("/shorts/")) {
            currentType = "Type C (Shorts Loop)";
        } else if (previousPage === "/" || previousPage.includes("youtube.com/$")) {
            currentType = "Type C (Home Recommendation)";
        } else if (previousPage.includes("/watch?v=")) {
            currentType = "Type C (Side Recommendation/Autoplay)";
        } else {
            currentType = "Type C (Other Passive)";
        }

        console.log(`[Start] Video Type: ${currentType}`);

        // 啟動心跳計時器
        startHeartbeat();
    }
    // 更新上一頁路徑
    sessionStorage.setItem("prevPath", location.pathname + location.search);
}

// 心跳計時器：每秒檢查一次影片狀態
function startHeartbeat() {
    if (trackingInterval) clearInterval(trackingInterval);

    trackingInterval = setInterval(() => {
        // 抓取頁面上的影片元素
        const video = document.querySelector('video');

        // 條件：影片存在 + 沒有暫停 + 沒有結束
        if (video && !video.paused && !video.ended) {
            watchedSeconds++;
        }
    }, 1000); // 每 1000 毫秒 (1秒) 檢查一次
}

// 結算並存檔 (包含上傳到 Google 表單)
function saveData() {
  if (watchedSeconds > 5) {
    let watchDate = new Date().toLocaleString();
    
    // 1. 抓取網頁標題
    let title = document.title;
    
    // 2. 清理標題 (把 "(1)" 和 "- YouTube" 去掉，只留影片名)
    // 例如: "(1) 影片標題 - YouTube" -> "影片標題"
    title = title.replace(/^\(\d+\)\s+/, "").replace(" - YouTube", "");

    // 如果抓不到標題（偶爾發生），就回傳網址當備案
    if (!title || title === "") {
        title = currentVideoUrl;
    }

    console.log(`[上傳中] 標題: ${title} | 時間: ${watchedSeconds}s`);
    
    // 3. 上傳到 Google 表單
    let formData = new FormData();
    formData.append(FIELD_IDS.USER, MY_NAME);
    formData.append(FIELD_IDS.TYPE, currentType);
    formData.append(FIELD_IDS.DURATION, watchedSeconds);
    
    // 關鍵：把原本傳網址的地方，改成傳標題
    formData.append(FIELD_IDS.URL, title); 

    fetch(GOOGLE_FORM_URL, {
      method: "POST",
      mode: "no-cors",
      keepalive: true, // 保命符：關閉分頁也能傳
      body: formData
    }).then(() => {
      console.log("數據已發送！");
    }).catch(err => {
      console.error("上傳失敗", err);
    });

    // 本地備份
    chrome.storage.local.get({logs: []}, function(result) {
      let logs = result.logs;
      logs.push({
        time: watchDate,
        type: currentType,
        duration: watchedSeconds,
        title: title, // 本地也多存一個標題欄位
        url: currentVideoUrl
      });
      chrome.storage.local.set({logs: logs});
    });
  }
}
// 重置狀態
function resetTracking() {
    if (trackingInterval) clearInterval(trackingInterval);
    currentVideoUrl = null;
    currentType = null;
    watchedSeconds = 0;
}