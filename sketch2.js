let sketch = function (p) {

    let greenStartTime = null;
    let lostStartTime = null;
    let success = false;
    let wasGreen = false;
    let guideTimer = null;

    const HOLD_TIME = 3000;
    const ERROR_TOLERANCE = 200;

    // 손 모양 인식 기준 완화
    const VERTICAL_THRESHOLD = 0.65;
    const FINGER_STRAIGHTNESS = 0.70;
    const FINGER_GAP = 0.65;
    const FINGER_ANGLE = 115;

    const defaultCaption =
        "내 손동작을 카메라에 보여주세요";

    const holdCaption =
        "손의 자세를 조금 더 유지해 주세요!";


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

        const length1 =
            Math.hypot(v1.x, v1.y, v1.z);

        const length2 =
            Math.hypot(v2.x, v2.y, v2.z);

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


    // 손가락의 펼쳐진 정도 계산
    function straightness(points, a, b, c, d) {

        const direct =
            getDistance(points[a], points[d]);

        const total =
            getDistance(points[a], points[b]) +
            getDistance(points[b], points[c]) +
            getDistance(points[c], points[d]);

        return direct / Math.max(total, 0.000001);
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

        p.translate(
            -p.width / 2,
            -p.height / 2
        );

        let greenHandCount = 0;

        const hands =
            detections?.multiHandLandmarks || [];


        for (let i = 0; i < hands.length; i++) {

            const landmarks = hands[i];

            // 화면 좌표
            const screenPoints = landmarks.map(point => ({
                x: point.x * p.width,
                y: point.y * p.height,
                z: point.z * p.width
            }));


            // 손 모양 판정용 3D 좌표
            const points =
                detections.multiHandWorldLandmarks?.[i] ||
                screenPoints;


            // 손바닥 크기 기준 정규화
            const palmSize = Math.max(
                getDistance(points[0], points[9]),
                0.000001
            );


            const ratio = (a, b) => {

                return getDistance(
                    points[a],
                    points[b]
                ) / palmSize;
            };


            const angle = (a, b, c) => {

                return getAngle(
                    points[a],
                    points[b],
                    points[c]
                );
            };


            /* ========================================
               1. 엄지 접힘 - 인식 조건 완화
            ======================================== */

            // 엄지가 확실하게 펼쳐진 경우만 오답 처리
            const isThumbExtended =

                ratio(4, 9) > 1.10 &&

                ratio(4, 5) > 0.90 &&

                angle(2, 3, 4) > 165;


            // 엄지가 가려지거나 위치가 부정확해도 허용
            const isThumbFolded = !isThumbExtended;


            /* ========================================
               2. 검지 펼침
            ======================================== */

            const isIndexExtended =

                straightness(
                    points, 5, 6, 7, 8
                ) > FINGER_STRAIGHTNESS &&

                angle(5, 6, 7) > FINGER_ANGLE;


            /* ========================================
               3. 중지 펼침
            ======================================== */

            const isMiddleExtended =

                straightness(
                    points, 9, 10, 11, 12
                ) > FINGER_STRAIGHTNESS &&

                angle(9, 10, 11) > FINGER_ANGLE;


            /* ========================================
               4. 약지 펼침
            ======================================== */

            const isRingExtended =

                straightness(
                    points, 13, 14, 15, 16
                ) > FINGER_STRAIGHTNESS &&

                angle(13, 14, 15) > FINGER_ANGLE;


            /* ========================================
               5. 새끼손가락 펼침
            ======================================== */

            const isPinkyExtended =

                straightness(
                    points, 17, 18, 19, 20
                ) > FINGER_STRAIGHTNESS &&

                angle(17, 18, 19) > FINGER_ANGLE;


            // 네 손가락 중 세 개 이상 펼쳐지면 인정
            const extendedFingerCount = [

                isIndexExtended,
                isMiddleExtended,
                isRingExtended,
                isPinkyExtended

            ].filter(Boolean).length;


            /* ========================================
               6. 네 손가락을 모은 상태
            ======================================== */

            const isFingersTogether =

                ratio(8, 12) < FINGER_GAP &&

                ratio(12, 16) < FINGER_GAP &&

                ratio(16, 20) < FINGER_GAP;


            /* ========================================
               7. 손날이 세로로 보이는 상태
            ======================================== */

            // 엄지와 손목은 수직 판정에서 제외
            // 검지부터 새끼손가락까지만 검사
            const verticalPoints = [

                5, 6, 7, 8,

                9, 10, 11, 12,

                13, 14, 15, 16,

                17, 18, 19, 20

            ].map(index => screenPoints[index]);


            const xValues =
                verticalPoints.map(point => point.x);

            const yValues =
                verticalPoints.map(point => point.y);


            const xRange =
                Math.max(...xValues) -
                Math.min(...xValues);


            const yRange =
                Math.max(...yValues) -
                Math.min(...yValues);


            // 손가락이 자연스럽게 휘어도 허용
            const verticalRatio =
                xRange / Math.max(yRange, 0.000001);


            const isHandVertical =
                verticalRatio < VERTICAL_THRESHOLD;


            /* ========================================
               8. 손가락이 위를 향하는지 확인
            ======================================== */

            const upwardFingerCount = [

                screenPoints[8].y <
                screenPoints[5].y,

                screenPoints[12].y <
                screenPoints[9].y,

                screenPoints[16].y <
                screenPoints[13].y,

                screenPoints[20].y <
                screenPoints[17].y

            ].filter(Boolean).length;


            // 네 손가락 중 세 개 이상 위를 향하면 인정
            const isHandUp =
                upwardFingerCount >= 3;


            /* ========================================
               '정말' 수어 최종 판정
            ======================================== */

            const isHandGreen =

                isThumbFolded &&

                extendedFingerCount >= 3 &&

                isFingersTogether &&

                isHandVertical &&

                isHandUp;


            /* ========================================
               랜드마크 색상 변경
            ======================================== */

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


        // 손을 내리면 유지 시간 초기화
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

            // 일시적인 인식 오류 처리
            if (lostStartTime !== null) {

                const lostDuration =
                    now - lostStartTime;

                if (lostDuration > ERROR_TOLERANCE) {

                    greenStartTime = null;

                } else if (greenStartTime !== null) {

                    greenStartTime += lostDuration;
                }

                lostStartTime = null;
            }


            // 유지 시간 측정 시작
            if (greenStartTime === null) {

                greenStartTime = now;
            }

            wasGreen = true;


            // 정확한 자세를 3초 유지
            if (now - greenStartTime >= HOLD_TIME) {

                const nextSheet = $(".next-btn");

                if (nextSheet.length === 0) {

                    console.error(
                        "바텀시트 요소를 찾을 수 없습니다."
                    );

                    greenStartTime = null;

                    return;
                }

                success = true;

                clearTimeout(guideTimer);

                $(".camera-caption").text(
                    defaultCaption
                );

                console.log("정말 수어 인식 성공");


                // 칭찬 바텀시트 표시
                nextSheet.css(
                    "visibility",
                    "visible"
                );
            }

        } else {

            // 인식 실패 시간 기록
            if (lostStartTime === null) {

                lostStartTime = now;
            }


            // 200ms 이상 자세가 풀리면 초기화
            if (
                now - lostStartTime >
                ERROR_TOLERANCE
            ) {

                greenStartTime = null;

                if (wasGreen) {

                    showHoldGuide();
                }

                wasGreen = false;
            }
        }
    };


    // 자세 유지 안내
    function showHoldGuide() {

        clearTimeout(guideTimer);

        $(".camera-caption").text(
            holdCaption
        );

        guideTimer = setTimeout(function () {

            $(".camera-caption").text(
                defaultCaption
            );

        }, 2000);
    }
};

new p5(sketch);