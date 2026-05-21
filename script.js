let count = 0;
let quality = 100;

const pizzaButton = document.getElementById('pizza-button');
const countDisplay = document.getElementById('count');
const qualityDisplay = document.getElementById('quality');

pizzaButton.addEventListener('click', () => {
    count++;
    countDisplay.textContent = count;
    if (quality > 0) {
        quality -= 0.5;
        qualityDisplay.textContent = Math.max(0, quality).toFixed(1);
    }
});