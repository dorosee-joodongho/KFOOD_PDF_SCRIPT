#!/bin/bash

echo "====  PDF 생성 스크립트 실행 ===="
read -p "날짜를 입력하세요 (예: 2025-10-24): " input_date

if [ -z "$input_date" ]; then
  echo "날짜를 입력해야 합니다."
  exit 1
fi

echo "▶️ 실행 중... (입력한 날짜: $input_date)"
node src/app.js --date="$input_date"

echo "작업 완료"

