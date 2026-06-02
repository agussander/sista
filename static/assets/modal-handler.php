<?php

$name=$_POST['nombre'];
$mail_tel=$_POST['telefono-mail'];


$email_subject="Interesado";
$email_body= "(El usuario está interesado y quiere ser contactado)\n".
"$name \n". 
"$mail_tel \n";


$mailheader = "Content-type: text/html; charset=UTF-8\r\n"; 

$honey=$_POST['firstname'];

$to="info@sista.com.ar";

if( !empty( $honey ) ){
    echo("Parece que hubo un error, intente comunicarse por otro de nuestros canales");
}else{
    mail($to,$email_subject,$email_body,$mailheader);
}
header('location: /gracias');

?>
