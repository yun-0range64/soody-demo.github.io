let sketch = function (p) {

    let greenStartTime = null;
    let lostStartTime = null;
    let success = false;
    let wasGreen = false;
    let guideTimer = null;

    const HOLD_TIME = 3000;
    const ERROR_TOLERANCE = 200;

    // 손 모양 인식 기준
    const VERTICAL_THRESHOLD = 0.50;
    const MIN_HAND_LENGTH = 1.35;

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
               1. 엄지손가락 접힘
            ======================================== */

            // 엄지가 확실하게 펼쳐진 경우만 오답 처리
            const isThumbExtended =

                ratio(4, 9) > 0.95 &&

                ratio(4, 5) > 0.75 &&

                angle(2, 3, 4) > 150;


            // 엄지가 가려져도 유연하게 판정
            const isThumbFolded = !isThumbExtended;


            /* ========================================
               2. 엄지를 제외한 랜드마크 수직 정렬
            ======================================== */

            // 엄지손가락 랜드마크 1~4 제외
            const verticalPoints = [

                0,

                5, 6, 7, 8,

                9, 10, 11, 12,

                13, 14, 15, 16,

                17, 18, 19, 20

            ].map(index => screenPoints[index]);


            const xValues =
                verticalPoints.map(point => point.x);

            const yValues =
                verticalPoints.map(point => point.y);


            // 손의 전체 가로 범위
            const xRange =
                Math.max(...xValues) -
                Math.min(...xValues);


            // 손의 전체 세로 범위
            const yRange =
                Math.max(...yValues) -
                Math.min(...yValues);


            // 가로 길이 대비 세로 정렬 정도
            const verticalRatio =
                xRange / Math.max(yRange, 0.000001);


            // 완벽한 일자가 아니어도 허용
            const isHandVertical =
                verticalRatio < VERTICAL_THRESHOLD;


            /* ========================================
               3. 손가락이 위를 향하는지 확인
            ======================================== */

            // 네 손가락 끝의 평균 Y좌표
            const averageTipY = (

                screenPoints[8].y +

                screenPoints[12].y +

                screenPoints[16].y +

                screenPoints[20].y

            ) / 4;


            // 네 손가락 시작점의 평균 Y좌표
            const averageBaseY = (

                screenPoints[5].y +

                screenPoints[9].y +

                screenPoints[13].y +

                screenPoints[17].y

            ) / 4;


            // 개별 손가락이 아닌 전체 방향으로 판정
            const isHandUp =
                averageTipY < averageBaseY;


            /* ========================================
               4. 주먹을 쥔 상태 방지
            ======================================== */

            // 손목부터 네 손가락 끝까지의 평균 거리
            const averageHandLength = (

                ratio(0, 8) +

                ratio(0, 12) +

                ratio(0, 16) +

                ratio(0, 20)

            ) / 4;


            // 손가락이 어느 정도 펼쳐져 있으면 인정
            const isHandExtended =
                averageHandLength > MIN_HAND_LENGTH;


            /* ========================================
               '정말' 수어 최종 판정
            ======================================== */

            const isHandGreen =

                isThumbFolded &&

                isHandVertical &&

                isHandUp &&

                isHandExtended;


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


        /* ========================================
           성공 처리
        ======================================== */

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