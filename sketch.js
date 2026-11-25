let canvas;

// 성공 처리 관련 변수
let greenStartTime = null;
let isSuccess = false;
let greenHandCount = 0;

// 안내 문구 관련 변수
let wasBothGreen = false;
let guideTimeout = null;

const defaultCaption =
    "내 손동작을 카메라에 보여주세요";

const holdCaption =
    "양손의 자세를 조금 더 유지해 주세요!";


// 안내 문구 표시
function showHoldGuide() {

    clearTimeout(guideTimeout);

    $(".camera-caption").text(holdCaption);

    guideTimeout = setTimeout(function() {

        $(".camera-caption").text(defaultCaption);

        guideTimeout = null;

    }, 2000);
}


// 안내 문구 초기화
function resetHoldGuide() {

    clearTimeout(guideTimeout);

    guideTimeout = null;

    $(".camera-caption").text(defaultCaption);
}


let sketch = function(p) {

   p.setup = function() {

    canvas = p.createCanvas(995, 575, p.WEBGL);

    p.ortho(
        -p.width / 2,
        p.width / 2,
        -p.height / 2,
        p.height / 2,
        -1000,
        1000
    );
};

    p.draw = function() {

        p.clear();
        p.translate(-p.width / 2, -p.height / 2);

        // 매 프레임 초록색 손 개수 초기화
        greenHandCount = 0;

        if (detections != undefined) {
            if (detections.multiHandLandmarks != undefined) {
                p.drawhands();
            }
        }

        // 현재 인식된 손의 개수
        const handCount =
            detections?.multiHandLandmarks?.length || 0;

        // 양손 모두 초록색인지 확인
        const isBothGreen =
            handCount === 2 && greenHandCount === 2;


        // 성공 처리
        if (!isSuccess) {

            if (isBothGreen) {

                // 타이머 시작
                if (greenStartTime === null) {
                    greenStartTime = performance.now();
                }

                // 양손 초록색 상태 3초 유지
                if (performance.now() - greenStartTime >= 3000) {

                    isSuccess = true;

                    resetHoldGuide();

                    $(".next-btn").css(
                        "visibility",
                        "visible"
                    );
                }

            } else {

                // 양손 인식이 풀린 경우
                if (wasBothGreen) {

                    showHoldGuide();
                }

                greenStartTime = null;
            }
        }

        wasBothGreen = isBothGreen;
    };


    p.drawhands = function() {

        p.strokeWeight(10);

        const keypoints = detections.multiHandLandmarks;

        for (let i = 0; i < keypoints.length; i++) {

            const hand = keypoints[i];


            /* ========================================
               3차원 랜드마크 좌표
            ======================================== */

            // MediaPipe의 3D 좌표 우선 사용
            const worldHand =
                detections.multiHandWorldLandmarks?.[i];

            // 3D 좌표가 없을 경우 기존 좌표 활용
            const points = worldHand || hand.map(point => ({
                x: point.x * p.width,
                y: point.y * p.height,
                z: point.z * p.width
            }));


            /* ========================================
               3차원 거리 계산
            ======================================== */

            function getDistance(a, b) {

                return Math.hypot(
                    points[a].x - points[b].x,
                    points[a].y - points[b].y,
                    points[a].z - points[b].z
                );
            }


            // 손바닥 크기 기준
            const palmSize = getDistance(0, 9);


            // 손 크기 대비 거리 비율
            function ratio(a, b) {

                return getDistance(a, b) /
                    Math.max(palmSize, 0.000001);
            }


            /* ========================================
               손가락 관절 각도 계산
            ======================================== */

            function getAngle(a, b, c) {

                const AB = {
                    x: points[a].x - points[b].x,
                    y: points[a].y - points[b].y,
                    z: points[a].z - points[b].z
                };

                const CB = {
                    x: points[c].x - points[b].x,
                    y: points[c].y - points[b].y,
                    z: points[c].z - points[b].z
                };

                const dot =
                    AB.x * CB.x +
                    AB.y * CB.y +
                    AB.z * CB.z;

                const lengthAB = Math.hypot(
                    AB.x, AB.y, AB.z
                );

                const lengthCB = Math.hypot(
                    CB.x, CB.y, CB.z
                );

                if (lengthAB * lengthCB < 0.000000000001) {
                    return NaN;
                }

                const cosAngle = dot / (lengthAB * lengthCB);

                return Math.acos(
                    Math.max(-1, Math.min(1, cosAngle))
                ) * 180 / Math.PI;
            }


            /* ========================================
               만나다 수어 인식 조건
               주먹을 쥐고 검지만 펴기
            ======================================== */

            // 엄지 접힘
            // 엄지 관절이 굽혀졌거나 손바닥에 가까움
            const isThumbFolded =
                getAngle(2, 3, 4) < 155 ||
                ratio(4, 5) < 0.65;


            // 검지 펴짐
            const isIndexExtended =
              getAngle(5, 6, 7) > 155 &&
              getAngle(6, 7, 8) > 150 &&
              ratio(8, 5) > 0.65 &&
              getDistance(8, 0) > getDistance(12, 0) * 1.15;


            // 중지 접힘
            const isMiddleFolded =
              getAngle(9, 10, 11) < 125 &&
              ratio(12, 9) < 0.8 &&
              ratio(12, 0) < 1.25;


            // 약지 접힘
            const isRingFolded =
                getAngle(13, 14, 15) < 125 &&
                ratio(16, 13) < 0.8;


            // 새끼손가락 접힘
            const isPinkyFolded =
                getAngle(17, 18, 19) < 135 &&
                ratio(20, 17) < 0.8;


            // 모든 손가락 조건 충족 여부
            const isHandGreen =
                isThumbFolded &&
                isIndexExtended &&
                isMiddleFolded &&
                isRingFolded &&
                isPinkyFolded;


            /* ========================================
               손 인식 상태에 따른 색상 변경
            ======================================== */

            if (isHandGreen) {

                p.stroke(0, 255, 0);

                greenHandCount++;

                $("#red1").attr(
                    "src",
                    "./images/green1.png"
                );

            } else {

                p.stroke(255, 0, 0);
            }


            /* ========================================
               손가락 관절 그리기
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

for (let j = 0; j < hand.length; j++) {

    const x = (
        hand[j].x * videoWidth * scale + offsetX
    ) / displayWidth * p.width;

    const y = (
        hand[j].y * videoHeight * scale + offsetY
    ) / displayHeight * p.height;

    p.point(x, y, 0);
}
        }
    };
};


// p5.js 실행close
let myp5 = new p5(sketch);