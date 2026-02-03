-- 경쟁 모드 주문서 확률 증가
-- 이노센트/혼줌: 15배
-- 장공/백줌: 10배

-- 이노센트 주문서 100% (ID 9): 0.28 → 4.2 (15배)
UPDATE incubator_items SET rate = 4.2 WHERE id = 9;

-- 혼돈의 주문서 60% (ID 23): 0.3 → 4.5 (15배)
UPDATE incubator_items SET rate = 4.5 WHERE id = 23;

-- 장갑 공격력 주문서 60% (ID 49): 0.3 → 3 (10배)
UPDATE incubator_items SET rate = 3 WHERE id = 49;

-- 백의 주문서 20% (ID 117): 1 → 10 (10배)
UPDATE incubator_items SET rate = 10 WHERE id = 117;

-- 백의 주문서 10% (ID 130): 2 → 20 (10배)
UPDATE incubator_items SET rate = 20 WHERE id = 130;

-- 백의 주문서 5% (ID 134): 3 → 30 (10배)
UPDATE incubator_items SET rate = 30 WHERE id = 134;

-- 장갑 공격력 주문서 10% (ID 139): 0.1 → 1 (10배)
UPDATE incubator_items SET rate = 1 WHERE id = 139;

-- 장갑 공격력 주문서 100% (ID 140): 0.05 → 0.5 (10배)
UPDATE incubator_items SET rate = 0.5 WHERE id = 140;
