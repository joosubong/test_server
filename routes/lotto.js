const express = require("express");
const fs = require('fs');
const csv = require('csv-parser');

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000; // 1일 밀리초
const CACHE_FILE = 'cache.json';

let cache = {
  lastDate: 0,
  results: null,
};

// 서버 시작 시 캐시 파일에서 읽어오기
function loadCacheFromFile() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      cache = JSON.parse(data);
      // lastDate를 Date 타입으로 바꿔주기 (JSON은 문자열로 저장됨)
      if (cache.lastDate) cache.lastDate = new Date(cache.lastDate);
    } catch (e) {
      console.error('캐시 파일 읽기 실패:', e);
      cache = { lastDate: 0, results: null };
    }
  }
}

// 캐시를 파일에 저장하기
function saveCacheToFile() {
  try {
    const saveData = {
      ...cache,
      lastDate: cache.lastDate ? cache.lastDate.toISOString() : 0, // ISO 문자열로 변환
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(saveData));
  } catch (e) {
    console.error('캐시 파일 저장 실패:', e);
  }
}

// 서버 시작 시 캐시 로드
loadCacheFromFile();

// CSV 자료 로또번호 정리 출력
router.get('/', (req, res) => {
  const results = [];

  fs.createReadStream('lotto.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      res.json(results);
    });
});

// CSV 읽는 함수
function readLottoCSV(callback) {
  const results = [];

  fs.createReadStream('lotto.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      callback(results);
    });
}

// 번호 추출
function extractNumbers(row) {
  return [
    row["1)"],
    row["2)"],
    row["3)"],
    row["4)"],
    row["5)"],
    row["6)"],
    row["보너스"]
  ].map(n => Number(n));
}

// 토요일 9시 기준 시점 계산 함수
function getLastSaturday9am(date) {
  const day = date.getDay(); // 0:일, 6:토
  const result = new Date(date);
  result.setHours(9, 0, 0, 0); // 오전 9시 셋팅

  // 토요일 날짜로 맞춤
  const diff = (day >= 6) ? day - 6 : day + 1 + 6;

  result.setDate(date.getDate() - diff);

  return result;
}

// 랜덤 번호 생성 함수 (random, random2, random8 모드 처리)
function generateNumbers(results, mode) {
  if (mode === 'random') {
    const baseCounts = Array(46).fill(0);
    results.forEach(row => {
      const numbers = extractNumbers(row);
      numbers.forEach(num => {
        if (num >= 1 && num <= 45) baseCounts[num]++;
      });
    });
    const finalResult = [];
    for (let t = 0; t < 4; t++) {
      const counts = [...baseCounts];
      const selected = new Set();
      while (selected.size < 6) {
        const total = counts.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 1; i <= 45; i++) {
          r -= counts[i];
          if (r <= 0) {
            selected.add(i);
            counts[i] = 0;
            break;
          }
        }
      }
      finalResult.push([...selected].sort((a, b) => a - b));
    }
    return finalResult;

  } else if (mode === 'random2') {
    const counts = Array(46).fill(0);
    results.forEach(row => {
      const numbers = extractNumbers(row);
      numbers.forEach(num => {
        if (num >= 1 && num <= 45) counts[num]++;
      });
    });
    const sorted = [];
    for (let i = 1; i <= 45; i++) {
      sorted.push({ num: i, count: counts[i] });
    }
    sorted.sort((a, b) => a.count - b.count);
    const excluded = new Set(sorted.slice(0, 15).map(v => v.num));
    const available = [];
    for (let i = 1; i <= 45; i++) {
      if (!excluded.has(i)) available.push(i);
    }
    const finalResult = [];
    for (let t = 0; t < 3; t++) {
      const pool = [...available];
      const selected = [];
      while (selected.length < 6) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool[idx]);
        pool.splice(idx, 1);
      }
      finalResult.push(selected.sort((a, b) => a - b));
    }
    return finalResult;

  } else if (mode === 'random8') {
    const recent8 = results.slice(-8);
    const appeared = new Set();
    recent8.forEach(row => {
      const numbers = extractNumbers(row);
      numbers.forEach(num => {
        if (num >= 1 && num <= 45) appeared.add(num);
      });
    });
    const missing8 = [];
    for (let i = 1; i <= 45; i++) {
      if (!appeared.has(i)) missing8.push(i);
    }
    const available = [];
    for (let i = 1; i <= 45; i++) {
      if (!missing8.includes(i)) available.push(i);
    }
    const finalResult = [];
    for (let t = 0; t < 3; t++) {
      const pool = [...available];
      const selected = [];
      while (selected.length < 6) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool[idx]);
        pool.splice(idx, 1);
      }
      finalResult.push(selected.sort((a, b) => a - b));
    }
    return finalResult;
  }
}

// 최종 라우터
router.get('/random', (req, res) => {
  const mode = req.query.mode || 'random';
  const now = new Date();
  const lastUpdate = new Date(cache.lastDate || 0);
  const lastSaturday9am = getLastSaturday9am(now);

  // 마지막 갱신이 이번주 토요일 9시 이후면 캐시 유지
  if (cache.lastDate && lastUpdate >= lastSaturday9am && cache.results && cache.results[mode]) {
    return res.json(cache.results[mode]);
  }

  // 새로 만들기 + 캐시 저장
  readLottoCSV(results => {
    if (!cache.results) cache.results = {};
    cache.results[mode] = generateNumbers(results, mode);
    cache.lastDate = now;
    saveCacheToFile();  // 캐시 파일에 저장
    res.json(cache.results[mode]);
  });
});

module.exports = router;
