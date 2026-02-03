-- 경쟁 모드 주문서 확률 원래대로 복구
-- 부스트 모드는 API에서 동적으로 처리

-- 이노센트 주문서 100% (ID 9): 4.2 → 0.28
UPDATE incubator_items SET rate = 0.28 WHERE id = 9;

-- 혼돈의 주문서 60% (ID 23): 4.5 → 0.3
UPDATE incubator_items SET rate = 0.3 WHERE id = 23;

-- 장갑 공격력 주문서 60% (ID 49): 3 → 0.3
UPDATE incubator_items SET rate = 0.3 WHERE id = 49;

-- 백의 주문서 20% (ID 117): 10 → 1
UPDATE incubator_items SET rate = 1 WHERE id = 117;

-- 백의 주문서 10% (ID 130): 20 → 2
UPDATE incubator_items SET rate = 2 WHERE id = 130;

-- 백의 주문서 5% (ID 134): 30 → 3
UPDATE incubator_items SET rate = 3 WHERE id = 134;

-- 장갑 공격력 주문서 10% (ID 139): 1 → 0.1
UPDATE incubator_items SET rate = 0.1 WHERE id = 139;

-- 장갑 공격력 주문서 100% (ID 140): 0.5 → 0.05
UPDATE incubator_items SET rate = 0.05 WHERE id = 140;
