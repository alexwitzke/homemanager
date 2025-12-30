var job;
var _url = $('#url');
var _name = $('#name');
var _selector = $('#selector');
var jobDialog = $('#jobDialog');

var backendUrl = "http://localhost:3000/api";

function jtoi() {
    _url.val(job.url);
    _selector.val(job.selector);
    //console.log(job.selector);
    //_left.val(job.left);
    //_top.val(job.top);
    //_width.val(job.width);
    //_height.val(job.height);
    _name.val(job.name);
}

function itoj() {
    if (job == null) {
        job = new Object();
        job.id = -1;
        jobs.push(job);
    }
    job.url = _url.val();   
    job.name = _name.val();
    job.selector = _selector.val();
}

function createJob() {
    job = new Object;
    showEditDialog();
}

function editJob(id) {
    $.ajax({
        url: backendUrl + '/job/' + id,
        type: 'GET',
        dataType: 'json',
        success: function (data) {
            job = data;
            jtoi();
            showEditDialog();
        },
        error: function (request, error) {
            job = null;
            alert("Request: " + JSON.stringify(request));
        }
    });
}

function showEditDialog() {
    jobDialog.modal({
        backdrop: 'static',
        keyboard: false
    })
}

function enableJob(id, value) {
    loadJob(id);
    job.enabled = value;
    saveJob(job);
}

function deleteJob(id) {
    $.ajax({
        url: backendUrl + '/job/' + id,
        type: 'DELETE',
        success: function (data) {
            location.reload();
        },
        error: function (request, error) {
            job = null;
            alert("Request: " + JSON.stringify(error));
        }
    });
}

function saveJob(job) {
    $.ajax({
        url: backendUrl + '/job/',
        type: 'POST',
        data: JSON.stringify(job),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
            //alert('done');
        },
        error: function (request, error) {
            alert("Request: " + JSON.stringify(request));
        }
    });
}

$('#close').click(function () {
    itoj();
    saveJob(job);
    jobDialog.modal('hide');
    location.reload();
});
$('#abort').click(function () {
    jobDialog.modal('hide');
});

jobDialog.on('shown.bs.modal', function () {
    if (job != null) {
        jtoi();       
    }
});

jobDialog.on('hidden.bs.modal', function () {
})

//see https://stackoverflow.com/questions/995183/how-to-allow-only-numeric-0-9-in-html-inputbox-using-jquery
// Restricts input for each element in the set of matched elements to the given inputFilter.
// (function ($) {
//     $.fn.inputFilter = function (inputFilter) {
//         return this.on("input keydown keyup mousedown mouseup select contextmenu drop", function () {
//             if (inputFilter(this.value)) {
//                 this.oldValue = this.value;
//                 this.oldSelectionStart = this.selectionStart;
//                 this.oldSelectionEnd = this.selectionEnd;
//             } else if (this.hasOwnProperty("oldValue")) {
//                 this.value = this.oldValue;
//                 this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
//             }
//         });
//     };
// }(jQuery));
