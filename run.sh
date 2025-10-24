# 실행 타입 선택
echo "실행할 작업을 선택하세요:"
echo "1) DB -> PDF"
echo "2) Excel -> PDF"
echo "3) 찾을 수 없는 사용자 기록"

read -p "선택 (1/2/3): " type_choice

case $type_choice in
  1)
    app_type="db_to_pdf"
    # DB -> PDF일 때만 날짜 입력
    read -p "날짜를 입력하세요 (예: 2025-10-24): " input_date
    if [ -z "$input_date" ]; then
      echo "날짜를 입력해야 합니다."
      exit 1
    fi
    ;;
  2)
    app_type="excel_to_pdf"
    ;;
  3)
    app_type="write_not_found_user"
    ;;
  *)
    echo "잘못된 선택입니다."
    exit 1
    ;;
esac

# 실행 메시지
if [ "$app_type" = "db_to_pdf" ]; then
  echo "DB 쿼리를 기반으로 PDF 생성 중... (날짜: $input_date)"
  node src/app.js --date="$input_date" --type="$app_type"
else
  echo "Excel 파일 처리 중..."
  node src/app.js --type="$app_type"
fi

echo "✅ 작업 완료"

