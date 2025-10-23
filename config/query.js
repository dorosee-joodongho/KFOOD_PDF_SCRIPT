module.exports={
    SELECT_QUERY: `
        SELECT u.name                                     AS \`회원명\`,
               COALESCE(a.licenseNumber, b.licenseNumber) AS \`인허가번호\`,
               CASE COALESCE(a.industryType, b.industryType)
                   WHEN 1 THEN '일반음식점'
                   WHEN 2 THEN '집단급식소'
                   WHEN 3 THEN '위탁급식업'
                   ELSE '기타'
                   END                                    AS \`업종\`,
               COALESCE(a.businessName, b.businessName)   AS \`업소명\`,
               CONCAT(u.address, ' ', u.address2)         As \`주소\`,
               u.userphone                                AS \`연락처\`,
               u.userid                                   AS \`아이디\`,
               u.email                                    AS \`이메일\`,
               u.birth                                    AS \`생년월일\`,
               u.regdate                                  AS \`가입일\`
        FROM kFood.tblUser u

                 LEFT JOIN (SELECT o.*
                            FROM kFood.tblOnlineEdu o
                            WHERE o.isFinishPayment = '1'
                              AND o.businessName NOT LIKE '%테스트%'
                              AND (o.userId, o.regDate) IN (SELECT userId, MAX(regDate)
                                                            FROM kFood.tblOnlineEdu
                                                            WHERE isFinishPayment = '1'
                                                              AND businessName NOT LIKE '%테스트%'
                                                            GROUP BY userId)) a ON u.userId = a.userId

                 LEFT JOIN (SELECT f.*
                            FROM kFood.tblOfflineEdu f
                            WHERE f.isFinishPayment = '1'
                              AND f.businessName NOT LIKE '%테스트%'
                              AND (f.userId, f.regDate) IN (SELECT userId, MAX(regDate)
                                                            FROM kFood.tblOfflineEdu
                                                            WHERE isFinishPayment = '1'
                                                              AND businessName NOT LIKE '%테스트%'
                                                            GROUP BY userId)) b
                           ON u.userId = b.userId AND a.userId IS NULL
        WHERE u.regdate BETWEEN '__START_DATE__' AND '__END_DATE__'
          AND u.status = '1'
        ORDER BY u.regdate;`
}