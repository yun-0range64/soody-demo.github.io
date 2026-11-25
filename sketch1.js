let sketch = function (p) {

    let greenStartTime = null;
    let lostStartTime = null;
    let success = false;
    let wasGreen = false;
    let guideTimer = null;

    const HOLD_TIME = 3000;
    const ERROR_TOLERANCE = 200;

    const defaultCaption = "내 손동작을 카메라에 보여주세요";
    const holdCaption = "손의 자세를 조금 더 유지해 주세요!";

    // 3차원 거리 계산
    function getDistance(a, b) {
        return Math.hypot(
            a.x - b.x,
            a.y - b.y,
            a.z - b.z
        );
    }

    // 방향 벡터 계산
    function getDirection(a, b) {
        return {
            x: b.x - a.x,
            y: b.y - a.y,
            z: b.z - a.z
        };
    }

    // 두 벡터 사이의 각도 계산
    function getVectorAngle(v1, v2) {

        const dot =
            v1.x * v2.x +
            v1.y * v2.y +
            v1.z * v2.z;

        const length1 = Math.hypot(v1.x, v1.y, v1.z);
        const length2 = Math.hypot(v2.x, v2.y, v2.z);

        if (length1 * length2 < 0.000000000001) {
            return NaN;
        }

        const cos = Math.max(
            -1,
            Math.min(1, dot / (length1 * length2))
        );

        return Math.acos(cos) * 180 / Math.PI;
    }

    // 관절 각도 계산
    function getAngle(a, b, c) {
        return getVectorAngle(
            getDirection(b, a),
            getDirection(b, c)
        );
    }

    // 여러 조건 중 필요한 개수 이상 충족하는지 확인
    function checkConditions(conditions, required) {
        return conditions.filter(Boolean).length >= required;
    }

    p.setup = function () {

        p.createCanvas(995, 575, p.WEBGL);

        // 원근 왜곡 제거
        p.ortho(
            -p.width / 2,
            p.width / 2,
            -p.height / 2,
            p.height / 2,
            -1000,
            1000
        );
    };

    p.draw = function () {

        p.clear();
        p.translate(-p.width / 2, -p.height / 2);

        let greenHandCount = 0;

        const hands = detections?.multiHandLandmarks || [];

        for (let i = 0; i < hands.length; i++) {

            const landmarks = hands[i];

            // 3D 랜드마크 우선 사용
            const points =
                detections.multiHandWorldLandmarks?.[i] ||
                landmarks.map(point => ({
                    x: point.x * p.width,
                    y: point.y * p.height,
                    z: point.z * p.width
                }));

            // 손바닥 크기 기준 정규화
            const palmSize = getDistance(
                points[0],
                points[9]
            );

            const ratio = (a, b) => {
                return getDistance(points[a], points[b]) /
                    Math.max(palmSize, 0.000001);
            };

            const angle = (a, b, c) => {
                return getAngle(
                    points[a],
                    points[b],
                    points[c]
                );
            };

            // 손가락의 실제 길이 대비 직선 거리
            function straightness(a, b, c, d) {

                const direct =
                    getDistance(points[a], points[d]);

                const total =
                    getDistance(points[a], points[b]) +
                    getDistance(points[b], points[c]) +
                    getDistance(points[c], points[d]);

                return direct / Math.max(total, 0.000001);
            }

            // 1. 엄지 펼침
            const isThumbExtended =
                ratio(4, 5) > 0.35 &&
                checkConditions([
                    angle(2, 3, 4) > 130,
                    ratio(4, 2) > 0.35,
                    straightness(1, 2, 3, 4) > 0.80
                ], 2);

            // 2. 검지 펼침
            const isIndexExtended =
                straightness(5, 6, 7, 8) > 0.80 &&
                checkConditions([
                    angle(5, 6, 7) > 135,
                    angle(6, 7, 8) > 130,
                    ratio(8, 5) > 0.55
                ], 2);

            // 3. 중지 펼침
            const isMiddleExtended =
                straightness(9, 10, 11, 12) > 0.80 &&
                checkConditions([
                    angle(9, 10, 11) > 135,
                    angle(10, 11, 12) > 130,
                    ratio(12, 9) > 0.55
                ], 2);

            // 4. 약지 접힘
            const isRingFolded =
                straightness(13, 14, 15, 16) < 0.85 &&
                (
                    angle(13, 14, 15) < 140 ||
                    ratio(16, 13) < 0.85
                );

            // 5. 새끼손가락 접힘
            const isPinkyFolded =
                straightness(17, 18, 19, 20) < 0.85 &&
                (
                    angle(17, 18, 19) < 145 ||
                    ratio(20, 17) < 0.85
                );

            // 손가락 방향 벡터
            const thumbDirection =
                getDirection(points[2], points[4]);

            const indexDirection =
                getDirection(points[5], points[8]);

            const middleDirection =
                getDirection(points[9], points[12]);

            const thumbIndexAngle = getVectorAngle(
                thumbDirection,
                indexDirection
            );

            const indexMiddleAngle = getVectorAngle(
                indexDirection,
                middleDirection
            );

            // 손가락 방향 조건
            const isThumbDirectionCorrect =
                thumbIndexAngle > 25 &&
                thumbIndexAngle < 145;

            const isFingerDirectionCorrect =
                indexMiddleAngle < 65;

            // 숫자 7 최종 판정
            const isHandGreen =
                isThumbExtended &&
                isIndexExtended &&
                isMiddleExtended &&
                isRingFolded &&
                isPinkyFolded &&
                isThumbDirectionCorrect &&
                isFingerDirectionCorrect;

            // 랜드마크 색상 변경
            if (isHandGreen) {
                greenHandCount++;
                p.stroke(0, 255, 0);
            } else {
                p.stroke(255, 0, 0);
            }


            /* ========================================
               손가락 관절 그리기
               PC 및 모바일 카메라 좌표 보정
            ======================================== */

            p.strokeWeight(14);

            const video = document.getElementById("video");

            if (!video || !video.videoWidth || !video.videoHeight) {
                continue;
            }

            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            const rect = video.getBoundingClientRect();

            const displayWidth = rect.width;
            const displayHeight = rect.height;

            const scale = Math.max(
                displayWidth / videoWidth,
                displayHeight / videoHeight
            );

            const offsetX =
                (displayWidth - videoWidth * scale) / 2;

            const offsetY =
                (displayHeight - videoHeight * scale) / 2;

            for (let j = 0; j < landmarks.length; j++) {

                const x = (
                    landmarks[j].x * videoWidth * scale + offsetX
                ) / displayWidth * p.width;

                const y = (
                    landmarks[j].y * videoHeight * scale + offsetY
                ) / displayHeight * p.height;

                p.point(x, y, 0);
            }
        }

        // 한 손만 정확해도 인정
        const isGreen = greenHandCount >= 1;
        const now = performance.now();

        if (success) {
            return;
        }

        // 손을 완전히 내리면 즉시 초기화
        if (hands.length === 0) {

            greenStartTime = null;
            lostStartTime = null;

            if (wasGreen) {
                showHoldGuide();
            }

            wasGreen = false;
            return;
        }

        // 정확한 자세인 경우
        if (isGreen) {

            // 짧은 인식 오류에서 복귀
            if (lostStartTime !== null) {

                const lostDuration = now - lostStartTime;

                if (lostDuration > ERROR_TOLERANCE) {
                    greenStartTime = null;
                } else if (greenStartTime !== null) {

                    // 인식 실패 시간은 유지 시간에서 제외
                    greenStartTime += lostDuration;
                }

                lostStartTime = null;
            }

            // 유지 시간 측정 시작
            if (greenStartTime === null) {
                greenStartTime = now;
            }

            wasGreen = true;

            // 3초 유지 완료
            if (now - greenStartTime >= HOLD_TIME) {

                const nextSheet = $(".next-btn");

                console.log("숫자 7 인식 성공");
                console.log("바텀시트 개수:", nextSheet.length);

                if (nextSheet.length === 0) {
                    console.error("바텀시트 요소를 찾을 수 없습니다.");
                    greenStartTime = null;
                    return;
                }

                clearTimeout(guideTimer);

                $(".camera-caption").text(defaultCaption);

                // 칭찬 바텀시트 표시
                nextSheet.css("visibility", "visible");

                success = true;
                window.number7Success = true;
            }

        } else {

            // 인식 오류 시작 시간 기록
            if (lostStartTime === null) {
                lostStartTime = now;
            }

            // 200ms 이상 자세가 풀리면 초기화
            if (now - lostStartTime > ERROR_TOLERANCE) {

                greenStartTime = null;

                if (wasGreen) {
                    showHoldGuide();
                }

                wasGreen = false;
            }
        }
    };

    // 자세 유지 안내 문구
    function showHoldGuide() {

        clearTimeout(guideTimer);

        $(".camera-caption").text(holdCaption);

        guideTimer = setTimeout(function () {
            $(".camera-caption").text(defaultCaption);
        }, 2000);
    }
};

new p5(sketch);