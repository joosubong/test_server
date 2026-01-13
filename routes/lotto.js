const express = require("express");
const fs = require('fs');
const csv = require('csv-parser');

const router = express.Router();

// CSV 자료 로또번호 정리 출력
router.get('/',(req, res)=>{
  const results = [];

  fs.createReadStream('lotto.csv')
    .pipe(csv())
    .on('data', (data)=> results.push(data))
    .on('end',()=>{
      res.json(results);
    });

});


//CSV 읽는 함수

function readLottoCSV(callback){
  const results = [];

    fs.createReadStream('lotto.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () =>{
      callback(results);
    })
}

//번호추출
function extractNumbers(row) {
  return[
    row["1)"],
    row["2)"],
    row["3)"],
    row["4)"],
    row["5)"],
    row["6)"],
    row["보너스"]
  ].map(n => Number(n));
}







// 각 번호마다 출현한 횟수 배열로 정리
router.get('/stats', (req, res) => {

//리스트 생성, 46번배열을 만들지만 0번은 사용안함
  const counts = Array(46).fill(0);

  readLottoCSV((results)=>{
  
    // 포문 각 번호 항목의 번호 추출
      results.forEach(row => {
        const numbers = extractNumbers(row);

        // 추출한 번호를 1회씩 더해 몇회 출연인지 정리
        numbers.forEach(num => {
          if (num >= 1 && num <= 45){
            counts[num]++;
          }
        });
      });
    
        // CSV 파일을 다 읽은 후 JSON 파일로 출력(첫번째 배열은 0 이므로 0만들어감 1<-아님)
        // 보기 좋은 키외 베류 형태로 변환
        const result = counts.map((count, index) => ({
        number: index,
        count
        //첫번째 배열 슬라이스
        })).slice(1);

        res.json(result);
    });
  });












      


// 15주간 출현하지 않은 번호 배열 만드는 라우터 (독립)
router.get('/missing15', (req, res) => {
  
  readLottoCSV((results)=>{

// 최근 15주 데이터만 선택
      const recent15 = results.slice(-15);
      const appearedNumbers = new Set();

        recent15.forEach(row => {
          const numbers=extractNumbers(row);

        numbers.forEach(num => {
          if (num >= 1 && num <= 45) {
            appearedNumbers.add(num);
          }
        });
     });

      const missingNumbers = [];
      for (let i = 1; i <= 45; i++) {
        if (!appearedNumbers.has(i)) {
          missingNumbers.push(i);
        }
      }

      res.json(missingNumbers);
    });
  });

















router.get('/rangeStats', (req, res) => {
 
  const counts = Array(46).fill(0);
  readLottoCSV((results) => {

  
      // 번호별 출현 횟수 집계
      results.forEach(row => {
        const numbers = extractNumbers(row);
         
        numbers.forEach(num => {
          if (num >= 1 && num <= 45)
            counts[num]++;
        });
      });

      // 구간별 출현 횟수 초기화
      const rangeCounts = {
        '1-9': 0,
        '10-19': 0,
        '20-29': 0,
        '30-39': 0,
        '40-45': 0
      };

      // counts 배열 기반으로 구간별 합산
      for (let i = 1; i <= 45; i++) {
        if (i <= 9) rangeCounts['1-9'] += counts[i];
        else if (i <= 19) rangeCounts['10-19'] += counts[i];
        else if (i <= 29) rangeCounts['20-29'] += counts[i];
        else if (i <= 39) rangeCounts['30-39'] += counts[i];
        else rangeCounts['40-45'] += counts[i];
      }

      res.json(rangeCounts);
    });
});











router.get('/random', (req, res) => {

  readLottoCSV((results) => {

    // 1. 번호별 출현 횟수 계산 (원본)
    const baseCounts = Array(46).fill(0);

    results.forEach(row => {
      const numbers = extractNumbers(row);
      numbers.forEach(num => {
        if (num >= 1 && num <= 45) baseCounts[num]++;
      });
    });

    // 2. 결과 저장 배열
    const finalResult = [];

    // 3. 3줄 생성
    for (let t = 0; t < 4; t++) {
      const counts = [...baseCounts]; // 원본 복사 (각 줄마다 독립)
      const selected = new Set();

      // 가중치 랜덤으로 6개 뽑기
      while (selected.size < 6) {
        const total = counts.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;

        for (let i = 1; i <= 45; i++) {
          r -= counts[i];
          if (r <= 0) {
            selected.add(i);
            counts[i] = 0; // 같은 줄에서 중복 방지
            break;
          }
        }
      }

      finalResult.push([...selected].sort((a, b) => a - b));
    }

    // 4. 3줄 결과 반환
    res.json(finalResult);
  });
});


router.get('/random2', (req, res) => {

  readLottoCSV((results) => {

    // 1. 번호별 출현 횟수 계산
    const counts = Array(46).fill(0);

    results.forEach(row => {
      const numbers = extractNumbers(row);
      numbers.forEach(num => {
        if (num >= 1 && num <= 45) counts[num]++;
      });
    });

    // 2. 하위 15개 번호 구하기
    const sorted = [];
    for (let i = 1; i <= 45; i++) {
      sorted.push({ num: i, count: counts[i] });
    }
    sorted.sort((a, b) => a.count - b.count);

    const excluded = new Set(sorted.slice(0, 15).map(v => v.num));

    // 3. 남은 번호
    const available = [];
    for (let i = 1; i <= 45; i++) {
      if (!excluded.has(i)) available.push(i);
    }

    // 4. 랜덤 3줄
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

    res.json(finalResult);
  });
});





router.get('/random8', (req, res) => {

  readLottoCSV((results) => {

    // 1. 최근 8주 데이터
    const recent8 = results.slice(-8);
    const appeared = new Set();

    recent8.forEach(row => {
      const numbers = extractNumbers(row);
      numbers.forEach(num => {
        if (num >= 1 && num <= 45) appeared.add(num);
      });
    });

    // 2. 8주간 안 나온 번호
    const missing8 = [];
    for (let i = 1; i <= 45; i++) {
      if (!appeared.has(i)) missing8.push(i);
    }

    const missingSet = new Set(missing8);

    // 3. 남은 번호
    const available = [];
    for (let i = 1; i <= 45; i++) {
      if (!missingSet.has(i)) available.push(i);
    }

    // 4. 랜덤 3줄
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

    res.json(finalResult);
  });
});




module.exports = router;